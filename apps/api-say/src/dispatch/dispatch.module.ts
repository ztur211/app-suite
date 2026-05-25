import { Module } from '@nestjs/common';
import { DoSdk } from '@things/do-sdk';
import { DispatchService } from './dispatch.service';
import { DoHandler } from './handlers/do.handler';
import { NoteHandler } from './handlers/note.handler';
import { SendHandler } from './handlers/send.handler';
import { BuyHandler } from './handlers/buy.handler';
import { EatHandler } from './handlers/eat.handler';

@Module({
  providers: [
    {
      provide: DoSdk,
      useFactory: () =>
        new DoSdk({
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          baseUrl: process.env['DO_API_URL']!,
          callerApp: 'api-say',
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          serviceTokenSecret: process.env['SERVICE_TOKEN_SECRET']!,
        }),
    },
    DoHandler,
    NoteHandler,
    SendHandler,
    BuyHandler,
    EatHandler,
    DispatchService,
  ],
  exports: [DispatchService],
})
export class DispatchModule {}
