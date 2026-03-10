import { gql } from "@apollo/client";

export const GET_PROBLEM_NUM_EXAMPLES = gql`
  query GetProblemNumExamples($number: Int) {
    problem(number: $number) {
      numExamples
    }
  }
`