#include <stdio.h>
#include <stdlib.h>
#include <string.h>

char *reverse(const char *s) {
    size_t n = strlen(s);
    char *out = malloc(n + 1);
    for (size_t i = 0; i < n; i++) {
        out[i] = s[n - 1 - i];
    }
    out[n] = '\0';
    return out;
}

int main(void) {
    const char *word = "alrabeta";
    char *rev = reverse(word);
    printf("%s\n", rev);
    free(rev);
    return 0;
}
