import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MediaSource, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessPolicyService } from '../../../common/authz/access-policy.service';
import type { Principal } from '../../../common/authz/principal';
import { updateWithOptimisticLock } from '../../../common/concurrency/optimistic-concurrency';
import type { CreateMediaDto, UpdateMediaDto } from './media.dto';

const NOT_FOUND = 'Media item not found.';

/**
 * The media library.
 *
 * Cloudinary holds the bytes and this holds the record. The split is the whole
 * design: the API never sees a file, so an upload cannot time out a request or
 * blow a body limit, and the credential that could write to Cloudinary lives in
 * the Next server rather than here.
 *
 * What this service is careful about is the gap that split creates. Between the
 * browser finishing its upload and this row being written, the asset exists in
 * Cloudinary and nowhere else — an orphan nothing lists and nobody can delete
 * through the UI. `create` is therefore forgiving about being called twice with
 * the same public id (it updates rather than failing), so a retry after a
 * dropped response reconciles instead of stranding a second copy.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
  ) {}

  async list(principal: Principal | undefined) {
    this.policy.requireScope(principal, 'newsroom:read');
    return this.prisma.mediaAsset.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async get(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:read');
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException(NOT_FOUND);
    return asset;
  }

  /**
   * Records an asset. Idempotent on `publicId`.
   *
   * The upload has already happened by the time this is called, so failing a
   * duplicate would leave the caller holding a file it cannot register and
   * cannot easily remove. Reconciling is the kinder and the safer answer.
   */
  async create(principal: Principal | undefined, dto: CreateMediaDto) {
    this.policy.requireScope(principal, 'newsroom:write');

    const source = dto.source ?? MediaSource.UPLOAD;

    // A cross-field rule, so it lives here rather than in a decorator: an
    // upload without a public id cannot be deleted from Cloudinary later, and a
    // link with one is claiming we host a file we do not.
    if (source === MediaSource.UPLOAD && !dto.publicId) {
      throw new BadRequestException('An uploaded item requires a Cloudinary publicId.');
    }
    if (source === MediaSource.LINK && dto.publicId) {
      throw new BadRequestException(
        'A linked item is hosted elsewhere and must not carry a publicId.',
      );
    }

    const fields = {
      kind: dto.kind,
      source,
      name: dto.name,
      alt: dto.alt ?? '',
      publicId: dto.publicId ?? null,
      url: dto.url,
      bytes: dto.bytes ?? null,
      width: dto.width ?? null,
      height: dto.height ?? null,
      format: dto.format ?? null,
    } satisfies Prisma.MediaAssetUncheckedCreateInput;

    try {
      if (dto.publicId) {
        // Upsert on the natural key, so a retried registration lands on the
        // same row rather than creating a second record of one file.
        return await this.prisma.mediaAsset.upsert({
          where: { publicId: dto.publicId },
          create: fields,
          update: fields,
        });
      }
      return await this.prisma.mediaAsset.create({ data: fields });
    } catch (cause) {
      // The unique constraint is the only expected failure and the upsert above
      // already handles it; anything reaching here is unexpected, so it is
      // logged with its context before the filter turns it into a response.
      this.logger.error(
        `Failed to record media ${dto.publicId ?? dto.url}: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
      throw cause;
    }
  }

  async update(principal: Principal | undefined, id: string, dto: UpdateMediaDto) {
    this.policy.requireScope(principal, 'newsroom:write');

    const existing = await this.prisma.mediaAsset.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(NOT_FOUND);

    const { expectedUpdatedAt, ...rest } = dto;
    return updateWithOptimisticLock(
      this.prisma.mediaAsset,
      id,
      expectedUpdatedAt,
      rest satisfies Prisma.MediaAssetUncheckedUpdateManyInput,
      NOT_FOUND,
    );
  }

  /**
   * Removes the row and reports the public id so the caller can delete the file.
   *
   * The file itself is not deleted here, because the credential that can do it
   * is deliberately not in this process. Returning the id rather than silently
   * dropping it is what stops a delete from leaving bytes behind that nothing
   * references and nobody is billed transparently for.
   */
  async remove(principal: Principal | undefined, id: string) {
    this.policy.requireScope(principal, 'newsroom:write');

    const existing = await this.prisma.mediaAsset.findUnique({
      where: { id },
      select: { id: true, publicId: true, source: true },
    });
    if (!existing) throw new NotFoundException(NOT_FOUND);

    await this.prisma.mediaAsset.delete({ where: { id } });

    return {
      id,
      deleted: true,
      /** Null for a link, which we never hosted and must not try to delete. */
      publicId: existing.source === MediaSource.UPLOAD ? existing.publicId : null,
    };
  }
}
