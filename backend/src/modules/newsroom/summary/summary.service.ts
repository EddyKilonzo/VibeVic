import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessPolicyService } from '../../../common/authz/access-policy.service';
import type { Principal } from '../../../common/authz/principal';

/**
 * How much is in the newsroom, without sending any of it.
 *
 * The settings screen shows one figure: how many records the workspace holds.
 * It used to reach that number by counting arrays it already had in memory,
 * which was free when the newsroom was a browser store. Against an API the same
 * screen would have to fetch eleven collections — every source, every quote,
 * every interview note — and then throw all of it away to render "47".
 *
 * That is worse than wasteful, it is a privacy regression. A count is a much
 * smaller thing to know than the records behind it, and a screen that only
 * needs the count should not be handed the material. So the counting happens
 * in the database and only the totals travel.
 *
 * ── The counts respect the confidential tier ─────────────────────────────
 * Every tiered table is filtered by the same `visibilityFilter` its own service
 * uses. This is not a detail: a total that included confidential rows would
 * announce, to a principal who cannot see them, exactly how many there are.
 * "You have 12 sources" against a list showing 9 is a disclosure, and it is the
 * kind that a summary endpoint written carelessly makes by default.
 */
@Injectable()
export class SummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
  ) {}

  async counts(principal: Principal | undefined): Promise<Record<string, number>> {
    this.policy.requireScope(principal, 'newsroom:read');

    // One filter, built once, applied to every tiered table below.
    const visible: Prisma.EnumVisibilityFilter = {
      in: this.policy.visibilityFilter(principal),
    };

    const [
      ideas,
      pitches,
      sources,
      quotes,
      interviews,
      entities,
      evidence,
      timeline,
      notes,
      deadlines,
      collections,
    ] = await this.prisma.$transaction([
      // Untiered: the whole collection is private, so every row counts.
      this.prisma.idea.count(),
      this.prisma.pitch.count(),
      // Tiered: filtered, for the reason in the class comment.
      this.prisma.source.count({ where: { visibility: visible } }),
      this.prisma.quote.count({ where: { visibility: visible } }),
      this.prisma.interview.count({ where: { visibility: visible } }),
      this.prisma.entity.count({ where: { visibility: visible } }),
      this.prisma.evidenceItem.count({ where: { visibility: visible } }),
      // Untiered rows whose links are filtered — the event itself is countable.
      this.prisma.timelineEvent.count(),
      this.prisma.note.count({ where: { visibility: visible } }),
      this.prisma.deadline.count(),
      this.prisma.collection.count(),
    ]);

    return {
      ideas,
      pitches,
      sources,
      quotes,
      interviews,
      entities,
      evidence,
      timeline,
      notes,
      deadlines,
      collections,
    };
  }
}
