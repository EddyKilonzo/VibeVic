import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { ReadEventKind } from '@prisma/client';

/**
 * What a browser is allowed to report.
 *
 * Deliberately tiny. Every field a reader-facing endpoint accepts is a field
 * somebody can lie in, so this carries the three that produce a number and
 * nothing that could identify anyone — no address, no user agent, no referrer,
 * no screen size. The server adds the timestamp and the day itself; a client
 * that could set those could backdate its own traffic.
 */
export class RecordEventDto {
  @IsIn(Object.values(ReadEventKind), {
    message: `kind must be one of: ${Object.values(ReadEventKind).join(', ')}.`,
  })
  kind!: ReadEventKind;

  /**
   * The per-tab session id, minted in the browser.
   *
   * Constrained in shape so the column cannot become a dumping ground: 8–64
   * characters of url-safe text. It is never read back out, so the only thing
   * the format has to guarantee is that it is bounded and boring.
   */
  @Matches(/^[A-Za-z0-9_-]{8,64}$/, {
    message: 'session must be 8-64 url-safe characters.',
  })
  session!: string;

  /**
   * Seconds listened, for LISTEN only.
   *
   * Capped at four hours. Not because anybody listens for four hours, but
   * because an uncapped integer from a browser is how one bad client turns the
   * mean listening time into a number nobody can interpret.
   */
  @IsInt()
  @Min(0)
  @Max(60 * 60 * 4)
  @IsOptional()
  seconds?: number;
}
