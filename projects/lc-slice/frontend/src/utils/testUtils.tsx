import {queries, render, Screen, screen} from '@testing-library/react'
// userEvent library simulates user interactions by dispatching the events that would happen if the interaction took place in a browser.
import userEvent from '@testing-library/user-event'
// add custom jest matchers from jest-dom
import '@testing-library/jest-dom'
import { RenderOptions } from '@testing-library/react'
// the component to test
import {MockedProvider, MockedResponse} from "@apollo/client/testing"
import { GET_GRID_FROM_PROBLEM_EXAMPLE } from '../database/queries/getGridFromProblemExample'

import { AppReducer, store as AppStore } from '../features/store'
import { RootState } from './types'
import React, { PropsWithChildren } from 'react'
import { PreloadedState } from '@reduxjs/toolkit'
import { Provider as MockedReduxProvider } from 'react-redux'
import { MockedProvider as MockedApolloClientProvider } from '@apollo/client/testing'


// Mocks prop of MockedProvider is an array of objects,
// which defines the mocked response for a single operation
const mocks = [
  {
    request: {
      query: GET_GRID_FROM_PROBLEM_EXAMPLE,
      variables: {
        number: 417,
        example: 0,
      }
    },
    result: {
      data: {
        problem: {
          title: "Pacific Atlantic Waterflow",
          problemId: "24681234",
          numExamples: 1,
          grids: [
            {
              gridId: "212312",
              gridData: [[1, 2, 3, 4]],
              interpretAs: "NUMBER",
              label: "Waterflow Grid #1"
            }


          ],
        }
      }
    }
  },
  {
    request: {
      query: GET_GRID_FROM_PROBLEM_EXAMPLE,
      variables: {
        number: 62,
        example: 0,
      }
    },
    result: {
      data: {
        problem: {
          title: "Unique Paths I",
          problemId: "24681233",
          numExamples: 1,
          grids: [
            {
              gridId: "212313",
              gridData: [
                [0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0]
              ],
              interpretAs: "NUMBER",
              label: "Unique Paths #1"
            }
          ],
        }
      }
    }

  }
];


interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries'> {
  preloadedState?: PreloadedState<AppReducer>,
  store?: typeof AppStore,
}

export const ifGenericButtons = (screen: Screen<typeof queries>) => {
  expect(screen.getByRole('button', {name: /Set Up/})).toBeInTheDocument();
  expect(screen.getByRole('button', {name: /Step/})).toBeInTheDocument();
  expect(screen.getByRole('button', {name: /Play/})).toBeInTheDocument();
  expect(screen.getByRole('button', {name: /Pause/})).toBeInTheDocument();
}

export const testClickStep = (
  screen: Screen<typeof queries>
) => {

}


export const renderWithProviders = (
  ui: React.ReactElement, 
  {
    preloadedState = {},
    store = AppStore,
    ...renderOptions
  }: ExtendedRenderOptions = {}) => {
    const Wrapper = ({children}: PropsWithChildren<{}>): JSX.Element => {
      return (
        <MockedReduxProvider store={store}>
          <MockedApolloClientProvider mocks={mocks} addTypename={false}>
            {children}
          </MockedApolloClientProvider>
        </MockedReduxProvider>
      );
    }
    return {store, ...render(ui, {wrapper: Wrapper, ...renderOptions})}
}

export const renderWithReduxProvider = (
  ui: React.ReactElement, 
  {
    preloadedState = {},
    store = AppStore,
    ...renderOptions
  }: ExtendedRenderOptions = {}) => {
    const Wrapper = ({children}: PropsWithChildren<{}>): JSX.Element => {
      return (
        <MockedReduxProvider store={store}>
            {children}
        </MockedReduxProvider>
      );
    }
    return {store, ...render(ui, {wrapper: Wrapper, ...renderOptions})}
}

