#!/bin/bash

echo "Running JavaScript tests..."
npm test

echo -e "\nCompiling and running C# tests..."
csc -r:System.Numerics.dll TestHarness.cs CoreMath.cs
mono TestHarness.exe 