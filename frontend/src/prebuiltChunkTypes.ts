import type { Level } from "./levelModel";

export type PrebuiltManifest = {
  version: number;
  chunkSize: number;
  maxLevel: number;
  chunks: { index: number; start: number; end: number; file: string }[];
};

export type PrebuiltChunk = {
  version: number;
  index: number;
  start: number;
  end: number;
  levels: Record<string, Level>;
};
