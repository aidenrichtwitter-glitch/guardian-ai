import {
  ARRAY_2D_IS_VALID_INDEX,
  ARRAY_2D_RETURN_VALID_INDICES
} from "../../gridUtils"

const defaultArray = [
    [0,  1,  2,  3,  4,  5 ],
    [6,  7,  8,  9,  10, 11],
    [12, 13, 14, 15, 16, 17],
    [18, 19, 20, 21, 22, 23],
    [24, 25, 26, 27, 28, 29],
];


const smol = [[1]];

describe('gridUtilsValidation tests', () => {
    test("if all existing cells are valid", () => {
        for (let i = 0; i < defaultArray.length; i++) {
            for (let j = 0; j < defaultArray[0].length; j++) {
                expect(ARRAY_2D_IS_VALID_INDEX(defaultArray, i, j)).toBeTruthy();
            }
        }
    })
    test("if returns false on invalid row", () => {
        expect(ARRAY_2D_IS_VALID_INDEX(defaultArray, defaultArray.length, 0)).toBeFalsy();
        expect(ARRAY_2D_IS_VALID_INDEX(defaultArray, defaultArray.length + 1, 0)).toBeFalsy();
    })

    test("if returns false on invalid column", () => {
        expect(ARRAY_2D_IS_VALID_INDEX(defaultArray, 0, defaultArray[0].length)).toBeFalsy();
        expect(ARRAY_2D_IS_VALID_INDEX(defaultArray, 0, defaultArray[0].length + 1)).toBeFalsy();
    })

    test("if ARRAY_2D_RETURN_VALID_INDICES returns valid indices when passed both valid and novalid values", () => {
      const testArray: [number, number][] = [
        [1, 2], [3, 4], [-1, -1], [0, -1], [0, 100], [-1, 0], [100, 0],
      ]
      expect(ARRAY_2D_RETURN_VALID_INDICES(defaultArray, testArray)).toEqual([
        [1, 2], [3, 4]
      ])
    })

    test("if ARRAY_2D_RETURN_VALID_INDICES test 2", () => {
      const testArray: [number, number][] = [
        [0, 0], [0, 5], [4, 0], [4, 5]
      ]
      expect(ARRAY_2D_RETURN_VALID_INDICES(defaultArray, testArray)).toEqual([
        [0, 0], [0, 5], [4, 0], [4, 5]
      ])
    })
})