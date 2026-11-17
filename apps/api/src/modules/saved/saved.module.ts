import { Module } from '@nestjs/common';
import { SavedController } from './saved.controller';
import { SavedService } from './saved.service';

/**
 * Owner: Listings & Search module.
 * Saved rooms (wishlist).
 */
@Module({
  controllers: [SavedController],
  providers: [SavedService],
})
export class SavedModule {}
