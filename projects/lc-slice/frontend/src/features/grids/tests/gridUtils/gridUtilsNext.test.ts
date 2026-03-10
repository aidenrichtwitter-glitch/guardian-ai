import {
  ARRAY_2D_GET_LAST_INDEX, 
  ARRAY_2D_GET_NEXT_INDEX, 
  ARRAY_2D_GET_PREVIOUS_INDEX
} from "../../gridUtils"

const defaultArray = [
    [0,  1,  2,  3,  4,  5 ],
    [6,  7,  8,  9,  10, 11],
    [12, 13, 14, 15, 16, 17],
    [18, 19, 20, 21, 22, 23],
    [24, 25, 26, 27, 28, 29],
];

const smol = [[1]];

describe("gridUtilsNext tests", () => {
    test("if ARR_2D_GET_NEXT_INDEX returns [-1, -1] for invalid cells", () => {
      expect(ARRAY_2D_GET_NEXT_INDEX(defaultArray, defaultArray.length, defaultArray[0].length)).toEqual([-1, -1]);
      expect(ARRAY_2D_GET_NEXT_INDEX(defaultArray, 0, defaultArray[0].length)).toEqual([-1, -1]);
      expect(ARRAY_2D_GET_NEXT_INDEX(defaultArray, defaultArray.length, 0)).toEqual([-1, -1]);
      expect(ARRAY_2D_GET_NEXT_INDEX(defaultArray, -1, -1)).toEqual([-1, -1]);
    })

    test("if each cell has a proper next cell", () => {
        const numRows = defaultArray.length;
        const numCols = defaultArray[0].length;
        for (let i = 0; i < defaultArray.length; i++) {
            for (let j = 0; j < defaultArray[0].length; j++) {
                if (i === numRows - 1 && j === numCols - 1) {
                    //eslint-disable-next-line
                    expect(ARRAY_2D_GET_NEXT_INDEX(defaultArray, i, j)).toEqual([0, 0]);
                    continue;
                }
                if (j === numCols - 1) {
                    //eslint-disable-next-line
                    expect(ARRAY_2D_GET_NEXT_INDEX(defaultArray, i, j)).toEqual([i + 1, 0]);
                    continue;
                } else {
                    //eslint-disable-next-line
                    expect(ARRAY_2D_GET_NEXT_INDEX(defaultArray, i, j)).toEqual([i, j + 1]);
                    continue;
                }    
            }
        }
    }) 
    test("if next cell of single cell grid will be itself", () => {
        const i = smol.length;
        const j = smol[0].length
        expect(ARRAY_2D_GET_NEXT_INDEX(smol, 0, 0)).toEqual([0, 0]);
    })

    test("if each cell has a proper previous cell", () => {
      const numRows = defaultArray.length;
      const numCols = defaultArray[0].length;
      for (let i = 0; i < defaultArray.length; i++) {
        for (let j = 0; j < defaultArray[0].length; j++) {
          if (i === 0 && j === 0) {
            //eslint-disable-next-line
            expect(ARRAY_2D_GET_PREVIOUS_INDEX(defaultArray, i, j)).toEqual([4, 5]);
            continue;
          }
          if (j === 0) {
            //eslint-disable-next-line
            expect(ARRAY_2D_GET_PREVIOUS_INDEX(defaultArray, i, j)).toEqual([i - 1, 5]);
            continue;
          } else {
            //eslint-disable-next-line
            expect(ARRAY_2D_GET_PREVIOUS_INDEX(defaultArray, i, j)).toEqual([i, j - 1]);
            continue;
          }    
        }
      }
    })

    test("if get final cell of grid works", () => {
      expect(ARRAY_2D_GET_LAST_INDEX(defaultArray)).toEqual([defaultArray.length - 1, defaultArray[0].length - 1])
      expect(ARRAY_2D_GET_LAST_INDEX(defaultArray)).toEqual([4, 5])
    })
})