import { Module } from '@nestjs/common';
import {
  CollectionsController,
  PortfolioController,
  StyleGuideController,
} from './curation/curation.controller';
import { CurationService } from './curation/curation.service';
import { DeadlinesController } from './deadlines/deadlines.controller';
import { DeadlinesService } from './deadlines/deadlines.service';
import { EntitiesController } from './entities/entities.controller';
import { EntitiesService } from './entities/entities.service';
import { EvidenceController } from './evidence/evidence.controller';
import { EvidenceService } from './evidence/evidence.service';
import { IdeasController } from './ideas/ideas.controller';
import { IdeasService } from './ideas/ideas.service';
import { InterviewsController } from './interviews/interviews.controller';
import { InterviewsService } from './interviews/interviews.service';
import { MediaController } from './media/media.controller';
import { MediaService } from './media/media.service';
import { NotesController } from './notes/notes.controller';
import { NotesService } from './notes/notes.service';
import { PitchesController } from './pitches/pitches.controller';
import { PitchesService } from './pitches/pitches.service';
import { QuotesController } from './quotes/quotes.controller';
import { QuotesService } from './quotes/quotes.service';
import { SourcesController } from './sources/sources.controller';
import { SourcesService } from './sources/sources.service';
import { SummaryController } from './summary/summary.controller';
import { SummaryService } from './summary/summary.service';
import { TimelineController } from './timeline/timeline.controller';
import { TimelineService } from './timeline/timeline.service';

/**
 * The newsroom surface — every record behind a published story.
 *
 * Sources came first, being the most sensitive table in the schema, and the
 * rest follow its shape: a controller carrying `@NewsroomOnly` and
 * `@RequireScopes`, and a service that asks AccessPolicyService again rather
 * than trusting the guard got there first. Media is the one outlier, and only
 * because the files themselves live in Cloudinary: this API stores the record
 * and the delivery URL, never the bytes.
 *
 * ── Three kinds of table, and how to tell which you are adding ───────────
 *
 *  1. **Tiered.** Sources, quotes, interviews, entities, evidence, notes. They
 *     carry `visibility`, are filtered in the `where` clause rather than after
 *     loading, and answer 404 — never 403 — for a confidential row, because a
 *     403 would confirm it exists.
 *
 *  2. **Private in whole.** Ideas, pitches, deadlines. No visibility column,
 *     because the entire collection is private and a per-row flag would only be
 *     something to set wrong. The scope check is the whole check.
 *
 *  3. **Untiered but linked to tiered.** Timeline, and pitches again. The row
 *     is readable by anyone in the newsroom while its *links* are filtered, so
 *     an event stays in the sequence but does not announce which protected
 *     source or entity it touches. `linkDiffPreservingHidden` is what stops
 *     such a caller deleting, by omission, a link they were never shown.
 *
 * Nothing in this module is ever `@PublicRead`, and nothing in it can be: there
 * is no public view for a source, a quote or an interview, so a route here
 * marked public would be refused by the serialiser at runtime rather than
 * quietly answered.
 */
@Module({
  controllers: [
    SourcesController,
    MediaController,
    IdeasController,
    PitchesController,
    QuotesController,
    InterviewsController,
    EntitiesController,
    EvidenceController,
    TimelineController,
    NotesController,
    DeadlinesController,
    CollectionsController,
    PortfolioController,
    StyleGuideController,
    SummaryController,
  ],
  providers: [
    SourcesService,
    MediaService,
    IdeasService,
    PitchesService,
    QuotesService,
    InterviewsService,
    EntitiesService,
    EvidenceService,
    TimelineService,
    NotesService,
    DeadlinesService,
    CurationService,
    SummaryService,
  ],
  exports: [
    SourcesService,
    MediaService,
    IdeasService,
    PitchesService,
    QuotesService,
    InterviewsService,
    EntitiesService,
    EvidenceService,
    TimelineService,
    NotesService,
    DeadlinesService,
    CurationService,
    SummaryService,
  ],
})
export class NewsroomModule {}
