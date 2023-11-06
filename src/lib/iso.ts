"use strict";

export const constQR = {
  // константы mode (см. Table 2 в JIS X 0510:2004 стр. 16)
  MODE_TERMINATOR: 0,
  MODE_NUMERIC: 1,
  MODE_ALPHANUMERIC: 2,
  MODE_OCTET: 4,
  isMode: (mode: string) => "124".includes(mode + ""),

  // уровни ECC (см. Table 22 в JIS X 0510:2004 стр. 45)
  ECCLEVEL_L: 1,
  ECCLEVEL_M: 0,
  ECCLEVEL_Q: 3,
  ECCLEVEL_H: 2,
  isEccl: (eccl: number) => eccl > -1 && eccl < 4,

  // возвращает количество битов, необходимое для записи количества данных
  // (см. Table 3 в JIS X 0510:2004 стp. 16)
  bitsFieldDataQuantity: (version: number, mode: number) => {
    switch (mode) {
      case constQR.MODE_NUMERIC:
        return version < 10 ? 10 : version < 27 ? 12 : 14;
      case constQR.MODE_ALPHANUMERIC:
        return version < 10 ? 9 : version < 27 ? 11 : 13;
      case constQR.MODE_OCTET:
        return version < 10 ? 8 : 16;
    }
    return 0;
  },

  // таблица значении символов в буквенно-цифровом кодировании
  // в виде объекта: {'A':10, ..., ':': 44, ...})
  // (см. Таблицу 5 в JIS X 0510:2004, стр. 19)
  ALPHANUMERIC_MAP: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"
    .split("")
    .reduce((map: { [key: string]: number }, ch, i) => {
      map[ch] = i;
      return map;
    }, {}),

  // журналы логов и антилогов (таблицы логарифмические и антилогарифмические значения),
  // используемые в арифметике GF(256) (формируются ниже)
  GF256: [] as number[],
  GF256_INV: [-1], // добавлена для согласования по индексу со значением из GF256

  // Генирирующие многочлены  (формируется ниже):
  // где i - количество байтов коррекции
  // GF256_GENPOLY[i] - соответствующий массив генерирующего многочлена
  GF256_GENPOLY: {} as { [key: number]: number[] },

  // дополняет код BCH(p+q,q) до полинома над GF(2) для корректного genpoly
  encodeBCH: (
    poly: number,
    bitsPoly: number,
    genpoly: number,
    bitsGenpoly: number
  ) => {
    let modulus = poly << bitsGenpoly;
    for (let i = bitsPoly - 1; i >= 0; --i) {
      if ((modulus >> (bitsGenpoly + i)) & 1) modulus ^= genpoly << i;
    }
    return (poly << bitsGenpoly) | modulus;
  },

  // маскировать функции с точки зрения номера строки и номера столбца
  // где  y/i относится к позиции строки рассматриваемого модуля и x/j к позиции его столбца
  // (см. Таблицу 20 в JIS X 0510:2004, стр. 42)
  MASKFUNCS: [
    (y: number, x: number) => (y + x) % 2 === 0,
    (y: number, x: number) => y % 2 === 0,
    (y: number, x: number) => x % 3 === 0,
    (y: number, x: number) => (y + x) % 3 === 0,
    (y: number, x: number) => (((y / 2) | 0) + ((x / 3) | 0)) % 2 === 0,
    (y: number, x: number) => ((y * x) % 2) + ((y * x) % 3) === 0,
    (y: number, x: number) => (((y * x) % 2) + ((y * x) % 3)) % 2 === 0,
    (y: number, x: number) => (((y + x) % 2) + ((y * x) % 3)) % 2 === 0,
  ],

  /* константы для начисления штрафных баллов для тестов матрицы QR-кода
  CONSECUTIVE:
    N1+(k-5) очков за каждый последовательный ряд из k модулей одного цвета,
    где k >= 5. количество перекрывающихся строк не учитывается
  TWOBYTWO:
    N2 очка за каждый блок 2x2 модулей одного цвета, перекрывающийся блок учитывается.
  FINDERLIKE:
    N3 баллы за каждый шаблон с >4W:1B:1W:3B:1W:1B или
    1B:1W:3B:1W:1B:>4W, или их кратные (например, очень маловероятно,
    но 13W:3B:3W:9B:3W:3B считает)
  DENSITY:
    N4*k точек для каждого (5*k)% отклонения от 50% плотности черного.
    т.е. k=1 для 55~60% и 40~45%, k=2 для 60~65% и 35~40% и т. д.
    (см. JIS X 0510:2004, раздел 8.8.2)
*/
  PENALTY: {
    CONSECUTIVE: 3,
    TWOBYTWO: 3,
    FINDERLIKE: 40,
    DENSITY: 10,
  },

  /* форматы изображений */
  IMAGE: ["PNG", "SVG", "HTML", "NONE"],
  /* размер модуля */
  modsize: 4,
  /* размер свободной зоны в модулях */
  margin: 4,
};

// формирование журналов QR-кода для поля Галуа 256:
// логарифмические GF256 (2^8) целочисленные значения с уменьшающим полиномом x^8+x^4+x^3+x^2+1
// и антилогарифмические GF256_INV значения,
// где GF256[GF256_INV[i]] == i для всех i в [1,256)
for (let i = 0, v = 1; i < 255; ++i) {
  constQR.GF256.push(v);
  constQR.GF256_INV[v] = i;
  v = (v * 2) ^ (v >= 128 ? 0x11d : 0); // 0x11d === 0b100011101
}

// формирование генерирующих многочленов (показатели степеней порождающего полинома)
// для создания кодовых слов исправления ошибок для QR-кода,
// совпадают с полиномами в JIS X 0510:2004 Приложение A
for (let i = 0, genpoly = [] as number[]; i < 30; ++i) {
  const poly = [];
  for (let j = 0; j <= i; ++j) {
    const a = j < i ? constQR.GF256[genpoly[j]] : 0;
    const b = constQR.GF256[(i + (genpoly[j - 1] || 0)) % 255];
    poly.push(constQR.GF256_INV[a ^ b]);
  }
  genpoly = poly;
  if ([7, 10, 13, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30].includes(i + 1))
    constQR.GF256_GENPOLY[i + 1] = poly;
}

/*
  информация о версии (см. JIS X 0510:2004, стр. 30–36, 71)
  infoVersion[i] - где i - номер версии
  [i,0]: количество байтов коррекции на один блок кода по уровням ECC
       (показатель степени генерирующего многочлена ):
       [i,0,eccl] , где eccl соответствует уровню корекции [M,L,H,Q]
  [i,1]: количество блоков кода по уровням ECC:
       [i,1,l] , где l соответствует уровням корекции [M,L,H,Q]
  [i,2]: левые верхние позиции направлющих шаблонов, начиная со 2 версии
         Примечание.
         С целью унификации алгоритма расчетов, для infoVersion[1,2} добавлен [],
         а для ных infoVersion[2...6, 2} добавлено по одной неиспользуемой координате (4)
 */
export const infoVersion = [
  null, // добавлен для обращения к infoVersion по номеру версии 1-40
  [[10, 7, 17, 13], [1, 1, 1, 1], []],
  [
    [16, 10, 28, 22],
    [1, 1, 1, 1],
    [4, 16],
  ],
  [
    [26, 15, 22, 18],
    [1, 1, 2, 2],
    [4, 20],
  ],
  [
    [18, 20, 16, 26],
    [2, 1, 4, 2],
    [4, 24],
  ],
  [
    [24, 26, 22, 18],
    [2, 1, 4, 4],
    [4, 28],
  ],
  [
    [16, 18, 28, 24],
    [4, 2, 4, 4],
    [4, 32],
  ],
  [
    [18, 20, 26, 18],
    [4, 2, 5, 6],
    [4, 20, 36],
  ],
  [
    [22, 24, 26, 22],
    [4, 2, 6, 6],
    [4, 22, 40],
  ],
  [
    [22, 30, 24, 20],
    [5, 2, 8, 8],
    [4, 24, 44],
  ],
  [
    [26, 18, 28, 24],
    [5, 4, 8, 8],
    [4, 26, 48],
  ],
  [
    [30, 20, 24, 28],
    [5, 4, 11, 8],
    [4, 28, 52],
  ],
  [
    [22, 24, 28, 26],
    [8, 4, 11, 10],
    [4, 30, 56],
  ],
  [
    [22, 26, 22, 24],
    [9, 4, 16, 12],
    [4, 32, 60],
  ],
  [
    [24, 30, 24, 20],
    [9, 4, 16, 16],
    [4, 24, 44, 64],
  ],
  [
    [24, 22, 24, 30],
    [10, 6, 18, 12],
    [4, 24, 46, 68],
  ],
  [
    [28, 24, 30, 24],
    [10, 6, 16, 17],
    [4, 24, 48, 72],
  ],
  [
    [28, 28, 28, 28],
    [11, 6, 19, 16],
    [4, 28, 52, 76],
  ],
  [
    [26, 30, 28, 28],
    [13, 6, 21, 18],
    [4, 28, 54, 80],
  ],
  [
    [26, 28, 26, 26],
    [14, 7, 25, 21],
    [4, 28, 56, 84],
  ],
  [
    [26, 28, 28, 30],
    [16, 8, 25, 20],
    [4, 32, 60, 88],
  ],
  [
    [26, 28, 30, 28],
    [17, 8, 25, 23],
    [4, 26, 48, 70, 92],
  ],
  [
    [28, 28, 24, 30],
    [17, 9, 34, 23],
    [4, 24, 48, 72, 96],
  ],
  [
    [28, 30, 30, 30],
    [18, 9, 30, 25],
    [4, 28, 52, 76, 100],
  ],
  [
    [28, 30, 30, 30],
    [20, 10, 32, 27],
    [4, 26, 52, 78, 104],
  ],
  [
    [28, 26, 30, 30],
    [21, 12, 35, 29],
    [4, 30, 56, 82, 108],
  ],
  [
    [28, 28, 30, 28],
    [23, 12, 37, 34],
    [4, 28, 56, 84, 112],
  ],
  [
    [28, 30, 30, 30],
    [25, 12, 40, 34],
    [4, 32, 60, 88, 116],
  ],
  [
    [28, 30, 30, 30],
    [26, 13, 42, 35],
    [4, 24, 48, 72, 96, 120],
  ],
  [
    [28, 30, 30, 30],
    [28, 14, 45, 38],
    [4, 28, 52, 76, 100, 124],
  ],
  [
    [28, 30, 30, 30],
    [29, 15, 48, 40],
    [4, 24, 50, 76, 102, 128],
  ],
  [
    [28, 30, 30, 30],
    [31, 16, 51, 43],
    [4, 28, 54, 80, 106, 132],
  ],
  [
    [28, 30, 30, 30],
    [33, 17, 54, 45],
    [4, 32, 58, 84, 110, 136],
  ],
  [
    [28, 30, 30, 30],
    [35, 18, 57, 48],
    [4, 28, 56, 84, 112, 140],
  ],
  [
    [28, 30, 30, 30],
    [37, 19, 60, 51],
    [4, 32, 60, 88, 116, 144],
  ],
  [
    [28, 30, 30, 30],
    [38, 19, 63, 53],
    [4, 28, 52, 76, 100, 124, 148],
  ],
  [
    [28, 30, 30, 30],
    [40, 20, 66, 56],
    [4, 22, 48, 74, 100, 126, 152],
  ],
  [
    [28, 30, 30, 30],
    [43, 21, 70, 59],
    [4, 26, 52, 78, 104, 130, 156],
  ],
  [
    [28, 30, 30, 30],
    [45, 22, 74, 62],
    [4, 30, 56, 82, 108, 134, 160],
  ],
  [
    [28, 30, 30, 30],
    [47, 24, 77, 65],
    [4, 24, 52, 80, 108, 136, 164],
  ],
  [
    [28, 30, 30, 30],
    [49, 25, 81, 68],
    [4, 28, 56, 84, 112, 140, 168],
  ],
];
