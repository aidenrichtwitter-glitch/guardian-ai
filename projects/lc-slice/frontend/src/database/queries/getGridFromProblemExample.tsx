import { gql } from "@apollo/client";

export const GET_GRID_FROM_PROBLEM_EXAMPLE = gql`
  query GetGridFromProblemExample($number: Int, $example: NonNegativeInt) {
    problem(number: $number) {
      title
      problemId
      numExamples
      grids(example: $example) {
        gridId
        gridData
        interpretAs
        label
      }
    }
  }
`