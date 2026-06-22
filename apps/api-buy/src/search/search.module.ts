import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { ProductSearchProvider } from './product-search.provider';
import { createProductSearchProvider } from './product-search.factory';

@Module({
  imports: [AuthModule],
  controllers: [SearchController],
  providers: [
    SearchService,
    {
      provide: ProductSearchProvider,
      useFactory: () => createProductSearchProvider(),
    },
  ],
  exports: [SearchService],
})
export class SearchModule {}
