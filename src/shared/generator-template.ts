export const DEFAULT_GENERATOR_TEMPLATE = `#include <bits/stdc++.h>
#include "testlib.h"
using namespace std;

int main(int argc, char* argv[]) {
    registerGen(argc, argv, 1);
    const int testIndex = opt<int>("testIndex", 1);
    const string mode = opt<string>("mode", "random");
    const int nMin = opt<int>("n_min", 1);
    const int nMax = opt<int>("n_max", 20);
    const int valueMin = opt<int>("a_min", -1000);
    const int valueMax = opt<int>("a_max", 1000);
    suppressEnsureNoUnusedOpts();

    if (nMin < 1 || nMax < nMin || valueMax < valueMin) return 1;
    const int width = valueMax - valueMin + 1;
    int n = rnd.next(nMin, nMax);
    if (mode == "boundary") n = (testIndex % 2 == 0 ? nMax : nMin);
    if (mode == "stress") n = nMax;
    if (mode == "constructive") n = min(nMax, nMin + (testIndex - 1) % max(1, nMax - nMin + 1));

    cout << n << '\\n';
    for (int i = 0; i < n; ++i) {
        int value = mode == "boundary"
            ? (i % 2 == 0 ? valueMin : valueMax)
            : mode == "constructive"
                ? valueMin + (i + testIndex - 1) % width
                : rnd.next(valueMin, valueMax);
        if (i) cout << ' ';
        cout << value;
    }
    cout << '\\n';
}`;

export const DEFAULT_VALIDATOR_TEMPLATE = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    // Starter template: add the problem-specific format and constraint checks here.
    string firstToken;
    if (!(cin >> firstToken)) {
        cerr << "Input is empty.\\n";
        return 1;
    }
    return 0;
}`;
