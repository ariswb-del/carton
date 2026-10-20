// Textures des objets vierges (photos dans /public/textures/). Laisser à null pour utiliser l'objet dessiné en code.
// Chaque zone « *Label » indique où se pose l'étiquette générée par le jeu, en % de l'image (gauche, haut, droite, bas).
// Format conseillé : prise de vue bien de face, sans perspective ni reflet.

export type Rect = [number, number, number, number];

export const TEXTURES = {
  vinylDisc: null as string | null,   // disque vinyle vierge vu de face, étiquette centrale vide (carré)
  cdTray: null as string | null,      // fond de boîtier CD ouvert, support de disque (142 × 125)
  k7Shell: '/textures/k7-shell.webp' as string | null, // cassette vierge redressée, texte d'origine effacé (100,4 × 63,8)

  // 8-track : façade (où se colle la pochette), dos (étiquette de pistes) et tranche (étiquette de rangement)
  eightFront: '/textures/8track-front.webp' as string | null,
  eightFrontLabel: [11.3, 20.6, 88.9, 80.1] as Rect,
  eightBack: '/textures/8track-back.webp' as string | null,
  eightBackLabel: [11, 31.5, 89.5, 99] as Rect,      // recouvre entièrement l'étiquette d'origine de la photo
  eightEdge: '/textures/8track-edge.jpg' as string | null,
  eightEdgeLabel: [1, 6, 92, 94] as Rect,            // recouvre entièrement l'étiquette d'origine de la photo
};

export const rectStyle = ([l, t, r, b]: Rect) => ({ left: `${l}%`, top: `${t}%`, right: `${100 - r}%`, bottom: `${100 - b}%` });
