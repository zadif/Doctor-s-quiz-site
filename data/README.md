# Quiz Data Files

This directory contains JSON data files for the quiz application.

## 450singlebest.json

This file contains 450 single best answer questions primarily for medical and biology subjects. The questions follow this format:

```json
[
  {
    "question": "The question text",
    "A": "Option A",
    "B": "Option B",
    "C": "Option C",
    "D": "Option D",
    "answer": "A", // The correct answer (A, B, C, or D)
    "explanation": "Explanation for the answer",
    "subject": "Biology" // The subject category
  }
]
```

For the quiz application, we filter this file to extract only Biology questions.
