https://cmhhelgeson.github.io/lc_slice/

LC Slice is a Work in Progress Website visually demonstrating common coding interview algorithms. It's purpose is to help new or developing programmers better visualize how to approach a problem, without explicitly giving them the code to solve it.

Currently, LC Slice only contains a limited number of problems, mainly based on common grid search and path-finding algorithms. However, the goal is to one day support multiple data structure visualization tools. 

While contributions are appreciated, one should caution themselves against adding new problems before solving them oneself. Although LC Slice can help with visualization, solving questions a priori with LC Slice adds additional complications to the problem such as having to reference and maintain a stack. 

Guidelines for creating a problem controller: 

1. Create a setup function: 
    A function that will 
        a. destroy any lingering data structures from previous problems
        b. setup the data structures necessary to visualize the current problem
        c. Destroy/Remove the previous problem controller and replace it with the new one

2. Create a step function: 
    A function that steps through the problem. 
    A step should only iterate over one cell of a grid, one node of a tree, one index of an array, one bucket of a hashmap, etc...
    If you'd like, different methodolgies for solving the problem can be placed within separate step functions called by separate pieces of the React UI. 

3. Create a complete function: 
    This function should run through each step of the problem automatically, calling upon the step function for each iteration. 

TODO: 
    Make UI more pleasant and interactive by implementing Framer.
    Complete and display more questions.
    Prevent editing of questions depending on question parameters.
    Add text and action log for each question.