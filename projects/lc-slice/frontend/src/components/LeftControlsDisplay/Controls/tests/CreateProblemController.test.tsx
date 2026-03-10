import {render, screen} from '@testing-library/react'
// userEvent library simulates user interactions by dispatching the events that would happen if the interaction took place in a browser.
import userEvent from '@testing-library/user-event'
// add custom jest matchers from jest-dom
import '@testing-library/jest-dom'
// the component to test
import {MockedProvider, MockedResponse} from "@apollo/client/testing"

import { ifGenericButtons, renderWithProviders } from '../../../../utils/testUtils'
import { QUESTIONS_ENUM } from '../../../../utils/questionEnum'
import { CreateProblemController } from '../CreateProblemController'

describe("Create Problem Controller Tests", () => {
  it.each(
    [
      QUESTIONS_ENUM.PACIFIC_ATLANTIC_WATER_FLOW, 
      QUESTIONS_ENUM.UNIQUE_PATHS,
      QUESTIONS_ENUM.UNIQUE_PATHS_II,
      QUESTIONS_ENUM.SHORTEST_BRIDGE,
      QUESTIONS_ENUM.FLOOD_FILL,
      QUESTIONS_ENUM.REMOVE_DUPLICATES_FROM_SORTED_LIST
    ])('renders basic controller buttons for problem %i', async (enumNum) => {
    const {store, ...renderResult} = renderWithProviders(
      <CreateProblemController
        animationOn={false}
        play={() => console.log("play")}
        pause={() => console.log("pause")}
        problemNumber={enumNum}
        animationSpeed={500} 
      />
    )
    ifGenericButtons(screen);
  })
})