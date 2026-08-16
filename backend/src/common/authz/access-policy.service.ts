import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Visibility } from '@prisma/client';
import { hasScope, type Principal, type Scope } from './principal';

/**
 * Authorisation, checked where the data is — not only at the door.
 *
 * The guard on the route decides whether a request may enter the newsroom at
 * all. This service decides whether *this* principal may see *this* record, and
 * every newsroom service calls it. The duplication is the point: a controller
 * is one forgotten decorator away from being open, and a service that trusts
 * its caller turns that single mistake into a breach. Two independent checks
 * mean one mistake is a bug, not an incident.
 */
@Injectable()
export class AccessPolicyService {
  /** Newsroom entry: authentication is not optional, ever. */
  requirePrincipal(principal: Principal | undefined): Principal {
    if (!principal) {
      throw new UnauthorizedException('Newsroom access requires authentication.');
    }
    return principal;
  }

  requireScope(principal: Principal | undefined, scope: Scope): Principal {
    const authenticated = this.requirePrincipal(principal);
    if (!hasScope(authenticated, scope)) {
      throw new ForbiddenException(`Missing scope: ${scope}`);
    }
    return authenticated;
  }

  canSeeConfidential(principal: Principal | undefined): boolean {
    return principal ? hasScope(principal, 'newsroom:confidential') : false;
  }

  /**
   * The visibility values this principal may load, for use in a `where` clause.
   *
   * Filtering in the query rather than after it is not an optimisation. A
   * confidential record is one whose *existence* must not leak; if it is never
   * fetched, there is no count, no pagination total and no "record 3 of 7" that
   * quietly announces it.
   */
  visibilityFilter(principal: Principal | undefined): Visibility[] {
    const visible: Visibility[] = [Visibility.PUBLISHABLE, Visibility.PRIVATE];
    if (this.canSeeConfidential(principal)) visible.push(Visibility.CONFIDENTIAL);
    return visible;
  }

  /**
   * Read check for a record already in hand.
   *
   * Denies a confidential record with 404 rather than 403, on purpose. A 403
   * says "this exists and you may not see it", which is precisely the fact
   * being protected. The caller learns nothing it did not already know.
   */
  assertCanRead(
    principal: Principal | undefined,
    record: { visibility: Visibility } | null,
    notFoundMessage = 'Record not found.',
  ): void {
    if (!record) throw new NotFoundException(notFoundMessage);
    this.requireScope(principal, 'newsroom:read');
    if (record.visibility === Visibility.CONFIDENTIAL && !this.canSeeConfidential(principal)) {
      throw new NotFoundException(notFoundMessage);
    }
  }

  /**
   * Create check. A record cannot be created confidential by a principal who
   * would then be unable to see it — that produces material nobody can review
   * or delete, which is a worse failure than refusing the write.
   */
  assertCanCreate(principal: Principal | undefined, visibility: Visibility): void {
    this.requireScope(principal, 'newsroom:write');
    if (visibility === Visibility.CONFIDENTIAL && !this.canSeeConfidential(principal)) {
      throw new ForbiddenException(
        'Creating a confidential record requires the newsroom:confidential scope.',
      );
    }
  }

  /**
   * Write check. Same 404-not-403 rule, plus: a principal that cannot see
   * confidential material cannot promote a record into it or out of it, since
   * declassifying a source is a decision only someone holding the confidential
   * scope is in a position to make.
   */
  assertCanWrite(
    principal: Principal | undefined,
    record: { visibility: Visibility } | null,
    nextVisibility?: Visibility,
    notFoundMessage = 'Record not found.',
  ): void {
    if (!record) throw new NotFoundException(notFoundMessage);
    this.requireScope(principal, 'newsroom:write');
    if (record.visibility === Visibility.CONFIDENTIAL && !this.canSeeConfidential(principal)) {
      throw new NotFoundException(notFoundMessage);
    }
    if (
      nextVisibility === Visibility.CONFIDENTIAL &&
      !this.canSeeConfidential(principal)
    ) {
      throw new ForbiddenException(
        'Changing a record to confidential requires the newsroom:confidential scope.',
      );
    }
  }

  /**
   * Whether the protected identity behind a pseudonym may be included.
   *
   * Deliberately a question a caller has to ask. `Source.protectedIdentity` is
   * never selected by default anywhere in this codebase; a service that wants
   * it must call this first and be seen to do so in review.
   */
  assertCanReadProtectedIdentity(principal: Principal | undefined): void {
    this.requireScope(principal, 'newsroom:confidential');
  }
}
