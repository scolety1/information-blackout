export const BEGIN_MISSED_REPORT = "information-blackout:begin-missed-report";

export interface BeginMissedReportMessage {
  type: typeof BEGIN_MISSED_REPORT;
}

export interface BeginMissedReportResponse {
  started: boolean;
  reason?: string;
}
