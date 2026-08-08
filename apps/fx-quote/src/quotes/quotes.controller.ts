import { Money } from "@monorepo/domain";
import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import { QuotesService } from "./quotes.service";

const QuoteQuery = z.object({
  from: z.string().regex(/^[A-Z]{3}$/),
  to: z.string().regex(/^[A-Z]{3}$/),
  amountMinorUnits: z.string().regex(/^\d+$/),
});

@Controller("quotes")
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Get()
  async get(@Query() query: unknown) {
    const parsed = QuoteQuery.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const { from, to, amountMinorUnits } = parsed.data;
    const quote = await this.quotes.getQuote(
      from,
      to,
      Money.of(BigInt(amountMinorUnits), from),
    );

    return {
      id: quote.id,
      sourceCurrency: quote.sourceCurrency,
      targetCurrency: quote.targetCurrency,
      rate: quote.rate,
      expiresAt: quote.expiresAt.toISOString(),
    };
  }
}
