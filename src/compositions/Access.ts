import { view, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
const { Sharing, Exchanging } = concepts;
export const Readable = view("(viewer) can read (item)", ({ viewer, item }, _, { scope }) => [
  where(Sharing._owned({ viewer, item }).is({ owned: true })),
  where(Sharing._scopes({ viewer, item }).is({ scope }), Exchanging._active({ exchange: scope }).is({ active: true })),
]).holds();
export const composition = { Readable };
