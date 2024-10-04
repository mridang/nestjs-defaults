import {
  Controller,
  Post,
  Body,
  Logger,
  ParseArrayPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  IsInt,
  IsString,
  IsUrl,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type, Expose } from 'class-transformer';
import { NelException } from './nel.exception';
import { InjectSentry } from '../sentry.decorator';
import { SentryService } from '../sentry.service';

class BodyDto {
  @Expose({ name: 'elapsed_time' })
  @IsInt()
  elapsedTime!: number;

  @Expose({ name: 'method' })
  @IsString()
  method!: string;

  @Expose({ name: 'phase' })
  @IsString()
  phase!: string;

  @Expose({ name: 'protocol' })
  @IsString()
  protocol!: string;

  @Expose({ name: 'referrer' })
  @IsString()
  @IsOptional()
  referrer?: string;

  @Expose({ name: 'sampling_fraction' })
  @IsInt()
  samplingFraction!: number;

  @Expose({ name: 'server_ip' })
  @IsString()
  serverIp!: string;

  @Expose({ name: 'status_code' })
  @IsInt()
  statusCode!: number;

  @Expose({ name: 'type' })
  @IsString()
  type!: string;
}

export class ReportDto {
  @IsInt()
  age!: number;

  @ValidateNested()
  @Type(() => BodyDto)
  body!: BodyDto;

  @Expose({ name: 'type' })
  @IsString()
  type!: string;

  @Expose({ name: 'url' })
  @IsUrl()
  url!: string;

  @Expose({ name: 'user_agent' })
  @IsString()
  userAgent!: string;
}

@Controller('report')
export class NelController {
  private readonly logger = new Logger(NelController.name);

  constructor(@InjectSentry() private readonly sentryService: SentryService) {
    //
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  handleReport(
    @Body(new ParseArrayPipe({ items: ReportDto })) reports: ReportDto[],
  ): void {
    this.logger.debug(
      `Received a NEL request containing ${reports.length} reports`,
    );
    reports.forEach((report) => {
      this.sentryService.instance().captureException(new NelException(report));
    });
  }
}
