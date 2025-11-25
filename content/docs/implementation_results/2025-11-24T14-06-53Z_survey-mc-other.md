# Initial Prompt
The Allow Other appears now in the NodeEditor, but not in the SurveyForm question step. Investigate why and fix

# Implementation Summary
Multiple-choice “Other” is now supported in the runtime renderer: SurveyQuestionRenderer adds an Other radio option with text input and syncs it as `Other: <text>`, using refs/watchers to manage selection. Checkbox Other remains intact.

# Documentation Overview
- Added an `OTHER_KEY` radio option and free-text input for multiple-choice; model values emit `Other: <text>`.  
- Imported refs/watchers to manage selection state; checkbox logic unchanged.

# Implementation Examples
- Selecting “Other” on a multiple-choice question shows the text input and emits `Other: foo`; switching back to a standard option clears the Other text.  
- Checkbox Other behavior remains as before.
