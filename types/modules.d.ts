declare module "density-clustering" {
  export class DBSCAN {
    run(dataset: number[][], epsilon: number, minPts: number): number[][];
  }
}

declare module "pdfjs-dist/legacy/build/pdf.js" {
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(src: { data: Uint8Array }): {
    promise: Promise<{
      numPages: number;
      getPage: (num: number) => Promise<{
        getTextContent: () => Promise<{
          items: unknown[];
        }>;
      }>;
      destroy: () => Promise<void>;
    }>;
  };
}
