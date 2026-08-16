import { IsISO8601 } from 'class-validator';

/**
 * Base class for every update DTO.
 *
 * `expectedUpdatedAt` is required, not optional. An optional concurrency token
 * is one a client will forget to send, and the failure mode of forgetting is
 * silent data loss — the one outcome this whole mechanism exists to prevent.
 * Clients send back the `updatedAt` they were given when they loaded the record.
 */
export abstract class VersionedUpdateDto {
  @IsISO8601()
  expectedUpdatedAt!: string;
}
