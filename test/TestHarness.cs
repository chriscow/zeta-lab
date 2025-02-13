using System;
using System.Numerics;

class TestHarness
{
    static void Main()
    {
        Console.WriteLine("C# Test Harness for Zeta Function");
        
        // Test indexToImag
        Console.WriteLine("\nTesting indexToImag...");
        double[] testIndices = new double[] { 1, 2, 3, 5.24 };
        foreach (var index in testIndices)
        {
            var result = CoreMath.IndexToImag(index, true);
            Console.WriteLine($"Index {index}: {result}");
        }

        // Test Riemann-Siegel formula
        Console.WriteLine("\nTesting Riemann-Siegel formula...");
        var testCases = new (double real, double index)[]
        {
            (0.5, 1),
            (0.5, 2),
            (0.5, 3)
        };

        foreach (var test in testCases)
        {
            var imag = CoreMath.IndexToImag(test.index, true);
            var s = new Complex(test.real, imag);
            var result = CoreMath.ReimannSiegel(s);
            Console.WriteLine($"s = {test.real} + {imag}i: ζ(s) = {result.Real:F6} + {result.Imaginary:F6}i");
        }
    }
} 