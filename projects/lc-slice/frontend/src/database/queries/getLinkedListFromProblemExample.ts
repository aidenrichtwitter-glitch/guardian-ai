import { gql } from "@apollo/client"

export const GET_LINKED_LIST_FROM_PROBLEM_EXAMPLE = gql`
  query GetLinkedListFromProblemExample($number: Int, $example: NonNegativeInt) {
    problem(number: $number) {
      title
      problemId
      numExamples
      linkedLists(example: $example) {
        listId
        listData
        linkStatus
        label
        problemNumber
      }
    }
  }
`;