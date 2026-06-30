// Temas de las escenas del overlay. Cada juego aporta paleta (variables CSS
// semánticas), tipografía, mascota/emoji y los textos. Los componentes de escena
// (Intro/Pause/Outro/GameHud) son genéricos y se parametrizan con uno de estos
// objetos — derivados del diseño de los HTML king-*/valorant-*/mecha-*.
//
// Variables CSS (rol semántico, válidas para temas claros y oscuros):
//   --bg / --bg2  fondo (degradado)   --text  texto principal
//   --accent      acento principal    --accent2  acento secundario
//   --panel       fondo de panel/píldora (rgba)  --panelBorder  borde (rgba)
//   --glow        color de resplandor

export const GAMES = ['king', 'valorant', 'mecha'];

export const THEMES = {
  king: {
    label: 'The King is Watching',
    font: "'Cinzel', serif",
    emoji: '👑',
    gameLabel: '👁 THE KING IS WATCHING',
    kicker: 'la corte se prepara',
    introTitle: ['EMPEZAMOS', 'PRONTO'],
    introSub: 'el rey ya observa su reino…',
    pauseTitle: 'PAUSA',
    pauseSub: 'el rey descansa… volvemos enseguida',
    outroTitle: ['GRACIAS POR', 'ACOMPAÑARNOS'],
    outroSub: 'el reino te espera en el próximo directo',
    outroCta: '¡Síguenos y únete a la corte! 👑',
    boots: ['forjando la corona…', 'alzando los estandartes…', 'el rey toma su trono…', 'afilando las espadas…', 'convocando a la corte…'],
    hudSub: 'su majestad observa',
    hudTag: '👁 EN PARTIDA',
    ticker: 'el rey observa su reino…  ✦  ¡síguenos y únete a la corte!  ✦  !redes  !discord',
    crest: '🛡️⚔️👑',
    vars: {
      '--bg': '#160c2e', '--bg2': '#2a1a4a', '--text': '#f3e7c9',
      '--accent': '#f5c542', '--accent2': '#b89bff',
      '--panel': 'rgba(42,26,74,.9)', '--panelBorder': 'rgba(245,197,66,.5)',
      '--glow': 'rgba(139,92,255,.5)',
    },
  },
  valorant: {
    label: 'Valorant',
    font: "'Oswald', sans-serif",
    emoji: '🎯',
    gameLabel: '🎯 VALORANT',
    kicker: 'preparando al agente',
    introTitle: ['EMPEZAMOS', 'PRONTO'],
    introSub: 'cargando el mapa…',
    pauseTitle: 'PAUSA',
    pauseSub: 'descanso táctico — volvemos ya',
    outroTitle: ['GRACIAS POR', 'VER EL DIRECTO'],
    outroSub: 'nos vemos en la próxima partida',
    outroCta: '¡Síguenos para no perderte la próxima! 🎯',
    boots: ['cargando el mapa…', 'seleccionando agente…', 'comprando armas…', 'plantando la spike…', 'afinando la puntería…'],
    hudSub: 'en partida',
    hudTag: '🎯 EN PARTIDA',
    ticker: 'clutch or kick  ✦  ¡síguenos si te mola el directo!  ✦  !redes  !discord',
    crest: '🔫💣🎯',
    vars: {
      '--bg': '#0f1923', '--bg2': '#1b2733', '--text': '#ece8e1',
      '--accent': '#ff4655', '--accent2': '#18e3b9',
      '--panel': 'rgba(27,39,51,.92)', '--panelBorder': 'rgba(255,70,85,.5)',
      '--glow': 'rgba(255,70,85,.4)',
    },
  },
  mecha: {
    label: 'Meccha Chameleon',
    font: "'Fredoka', sans-serif",
    emoji: '🦎',
    gameLabel: '🎨 MECCHA CHAMELEON',
    kicker: '¡prepara los pinceles!',
    introTitle: ['EMPEZAMOS', 'PRONTO'],
    introSub: 'nos camuflamos en un momentito…',
    pauseTitle: 'PAUSA',
    pauseSub: 'cambiando de color… volvemos enseguida',
    outroTitle: ['GRACIAS POR', 'ACOMPAÑARNOS'],
    outroSub: '¡nos vemos en el próximo camuflaje!',
    outroCta: '¡Síguenos si te mola el directo! 🦎',
    boots: ['mezclando colores…', 'mojando el pincel…', 'eligiendo el mejor escondite…', 'modo camuflaje: ON 🦎', 'afinando la pose perfecta…'],
    hudSub: '¡en modo camuflaje!',
    hudTag: '🎨 EN PARTIDA',
    ticker: '¿me encontrarás camuflado?  ✦  ¡síguenos si te mola el directo!  ✦  !redes  !discord',
    crest: '🎨🖌️🦎',
    vars: {
      '--bg': '#fffaf2', '--bg2': '#ffffff', '--text': '#2a2433',
      '--accent': '#ff6ec7', '--accent2': '#4ea8ff',
      '--panel': 'rgba(255,255,255,.94)', '--panelBorder': 'rgba(176,107,255,.25)',
      '--glow': 'rgba(176,107,255,.25)',
    },
  },
};

export const getTheme = (game) => THEMES[game] || THEMES.king;
