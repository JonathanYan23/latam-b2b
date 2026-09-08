declare module "pdf-parse" {
  interface PdfParseResult {
    text: string;
    numpages?: number;
    info?: Record<string, unknown>;
  }
  function pdfParse(data: Buffer, options?: unknown): Promise<PdfParseResult>;
  export default pdfParse;
}
