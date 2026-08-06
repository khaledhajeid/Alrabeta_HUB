#include <stdio.h>
#include <pthread.h>

static int counter = 0;

void *bump(void *arg) {
    for (int i = 0; i < 100000; i++) {
        counter++; /* no mutex: two threads race on this */
    }
    return NULL;
}

int main(void) {
    pthread_t a, b;
    pthread_create(&a, NULL, bump, NULL);
    pthread_create(&b, NULL, bump, NULL);
    pthread_join(a, NULL);
    pthread_join(b, NULL);
    printf("counter=%d\n", counter);
    return 0;
}
