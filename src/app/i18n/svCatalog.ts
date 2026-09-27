// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The Swedish catalog as the runtime loads it (`./index.ts`, on demand): the
// base strings, plus the achievements copy in a build that carries
// achievements (`../achievementsBuilt.ts`). The join happens here, inside the
// code-split chunk, so the phone and desktop builds drop the copy with the
// branch that uses it.

import { ACHIEVEMENTS_BUILT } from "../achievementsBuilt.ts";
import type { Catalog } from "./index.ts";
import { sv } from "./sv.ts";
import { svAchievements } from "./svAchievements.ts";

export const svCatalog = (
  ACHIEVEMENTS_BUILT ? { ...sv, achievements: svAchievements } : sv
) as Catalog;
