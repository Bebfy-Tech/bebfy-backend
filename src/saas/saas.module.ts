import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SaasAuthService } from './saas-auth.service';
import { SaasAuthGuard } from './saas-auth.guard';
import { SaasAuthController, SaasStaffController } from './saas-auth.controller';
import { SaasService } from './saas.service';
import { SaasAuditInterceptor } from './saas-audit.interceptor';
import { SaasController } from './saas.controller';
import { PrismaModule } from '../core/prisma/prisma.module';

@Module({
  imports: [PrismaModule, JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '8h' } })],
  controllers: [SaasController, SaasAuthController, SaasStaffController],
  providers: [SaasService, SaasAuthService, SaasAuthGuard, SaasAuditInterceptor],
  exports: [SaasService],
})
export class SaasModule {}