using System;
using System.Numerics;

public static class CoreMath
{
    const double TWO_PI = Math.PI * 2;
    static readonly double SQRT_TWO_PI = Math.Sqrt(TWO_PI);

    public static double IndexToImag(double index, bool useNew = true)
    {
        if (useNew)
        {
            // new formula: 2pi*(t^2+t+1/6)
            return 2.0 * Math.PI * ((index * index) + index + (1.0 / 6.0));
        }
        else
        {
            // old formula: (π (2 n + 1))/( log(n + 1) - log(n))
            return (index * 2.0 + 1.0) * Math.PI / (Math.Log(index + 1.0) - Math.Log(index));
        }
    }

    private static double V(double t)
    {
        bool fewerTerms = false;
        double result = t / 2 * Math.Log(t / (2 * Math.PI)) - t / 2 - Math.PI / 8;

        if (!fewerTerms)
        {
            result += 1 / (48 * t) +
                     7 / (5760 * Math.Pow(t, 3)) +
                     31 / (80640 * Math.Pow(t, 5)) +
                     127 / (430080 * Math.Pow(t, 7)) +
                     511 / (1216512 * Math.Pow(t, 9));
        }

        return result;
    }

    public static Complex ReimannSiegel(Complex s)
    {
        double t = s.Imaginary;
        int v = (int)Math.Floor(Math.Sqrt(t / (2 * Math.PI)));

        // Calculate Z(t)
        Complex sum = new Complex();
        for (int k = 1; k <= v; k++)
        {
            double angle = V(t) - t * Math.Log(k);
            sum += new Complex(
                Math.Cos(angle) / Math.Sqrt(k),
                Math.Sin(angle) / Math.Sqrt(k)
            );
        }
        sum *= 2;

        // Calculate theta correction term
        double T = Math.Sqrt(t / (2 * Math.PI)) - v;
        double phi = Math.Cos(2 * Math.PI * (T * T - T - 1.0 / 16.0)) / Math.Cos(2 * Math.PI * T);
        double c0 = phi;

        Complex correction = Math.Pow(-1, v - 1) * Math.Pow(2 * Math.PI / t, 0.25) * c0;

        return sum + correction;
    }
} 