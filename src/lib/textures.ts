// Textures des objets vierges. Laisser à null pour utiliser les objets dessinés en code.
// Pour utiliser des photos : déposer les fichiers dans /public/textures/ et indiquer leur chemin ici.
// Format attendu : PNG à fond transparent, prise de vue bien de face, sans reflet.
export const TEXTURES: {
  vinylDisc: string | null;   // disque vinyle vierge vu de face, étiquette centrale vide (carré)
  cdTray: string | null;      // fond de boîtier CD ouvert, support de disque (142 × 125)
  k7Shell: string | null;     // cassette vierge vue de face, à plat, à l'horizontale (100 × 64)
  eightBody: string | null;   // façade de cartouche 8-track sans étiquette (100 × 135)
} = {
  vinylDisc: null,
  cdTray: null,
  k7Shell: null,
  eightBody: null,
};
