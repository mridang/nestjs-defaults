import { ReportDto } from './nel.controller';

export class NelException extends Error {
  constructor(public readonly report: ReportDto) {
    super(`Encountered a ${report.type} error on the client`);
  }
}
