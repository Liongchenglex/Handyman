<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>HandyConnect - Payment</title>
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script>
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "primary": "#38e07b",
                        "background-light": "#f6f8f7",
                        "background-dark": "#122017",
                        "foreground-light": "#111714",
                        "foreground-dark": "#f6f8f7",
                        "muted-light": "#648772",
                        "muted-dark": "#a0b5a9",
                        "border-light": "#e0e6e2",
                        "border-dark": "#2a3c31"
                    },
                    fontFamily: {
                        "display": ["Space Grotesk", "sans-serif"]
                    },
                    borderRadius: {
                        "DEFAULT": "0.5rem",
                        "lg": "0.75rem",
                        "xl": "1rem",
                        "full": "9999px"
                    },
                },
            },
        }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
    </style>
</head>
<body class="bg-background-light dark:bg-background-dark font-display text-foreground-light dark:text-foreground-dark">
<div class="min-h-screen flex flex-col">
<header class="sticky top-0 z-10 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm">
<div class="container mx-auto px-4 sm:px-6 lg:px-8">
<div class="flex items-center justify-between h-16 border-b border-border-light dark:border-border-dark">
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-primary text-3xl">construction</span>
<h1 class="text-xl font-bold tracking-tight">HandyConnect</h1>
</div>
<div class="flex items-center gap-4">
<button class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
<span class="material-symbols-outlined text-muted-light dark:text-muted-dark">help</span>
</button>
<div class="w-10 h-10 rounded-full bg-cover bg-center" style='background-image: url("https://lh3.googleusercontent.com/a/ACg8ocK_1Y-d_2q9ZU9y-O5J6Jz_8cZ2gC5gY7jD6Qj3R3qI=s96-c");'></div>
</div>
</div>
</div>
</header>
<main class="flex-grow container mx-auto max-w-lg px-4 sm:px-6 lg:px-8 py-8">
<div class="space-y-8">
<a class="flex items-center gap-2 text-sm font-medium text-muted-light dark:text-muted-dark hover:text-foreground-light dark:hover:text-foreground-dark transition-colors" href="#">
<span class="material-symbols-outlined">arrow_back</span>
<span>Back to Job Details</span>
</a>
<div>
<h2 class="text-2xl font-bold tracking-tight mb-4">Estimated price breakdown</h2>
<div class="rounded-lg border border-border-light dark:border-border-dark p-4 space-y-3">
<div class="flex justify-between items-center">
<p class="text-muted-light dark:text-muted-dark">Service fee</p>
<p class="font-medium">$120.00</p>
</div>
<div class="flex justify-between items-center">
<p class="text-muted-light dark:text-muted-dark">Platform fee</p>
<p class="font-medium">$5.00</p>
</div>
<div class="border-t border-border-light dark:border-border-dark my-3"></div>
<div class="flex justify-between items-center text-lg">
<p class="font-bold">Total</p>
<p class="font-bold">$125.00</p>
</div>
</div>
</div>
<div>
<h2 class="text-2xl font-bold tracking-tight mb-4">Payment method</h2>
<fieldset>
<legend class="sr-only">Payment method</legend>
<div class="space-y-3">
<label class="flex items-center p-4 rounded-lg border border-border-light dark:border-border-dark has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary dark:has-[:checked]:border-primary cursor-pointer transition-all">
<input checked="" class="sr-only" name="payment-method" type="radio"/>
<span class="flex-grow font-medium">PayNow</span>
<img alt="PayNow logo" class="h-6" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAw187E7vJgIZ5qhTAGeyFp2iiILcE55heS6OEHCXHhathRZIaSfuaewDf8lUFloIw9V4DGEQZ-Ls6QQ1LmUHEQ0n-u8RhO0yXwQHxF-NiYLjKLwHoLTbg8sKh8rrvGtndYACzzA9QuHx4vI6KXsSkVkX6IVY5b6vsRub2_lPlvRD2_81FqGMVNWk4mhUi5ZybAhfsMhYluoVMP6NmYbJOETAQ38aURXcH8l6VvreNi8aV_WdkStWZzP5gk82XWQXJynC2rNC3OHLcT"/>
</label>
<label class="flex items-center p-4 rounded-lg border border-border-light dark:border-border-dark has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary dark:has-[:checked]:border-primary cursor-pointer transition-all">
<input class="sr-only" name="payment-method" type="radio"/>
<span class="flex-grow font-medium">PayLah!</span>
<img alt="PayLah! logo" class="h-6" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDw3Jvp1q59sLBADkbjMNUq80HIcBIAI4Vbldx3oTHj4qbPssuusYv5xWm7XuMFC8cstlRWRwaImv--MDx3w0jDn7cvzIjJWPDGMyUrqiQti5HTYCj7Q-W-2OGZLe4gkORVC5593Q6KaEZqAnG3oTHFZ8ZQ1uFehU6ma_Ry6fn_MsgTW7whdwlgkupAJBs2JYm6T2ksL7mptCYoInluWIvOss3GF9mt30Axf2t2ciekpr6q7KiriyUFC014gWcDBEaBuaBC6KX5-onY"/>
</label>
<label class="flex items-center p-4 rounded-lg border border-border-light dark:border-border-dark has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary dark:has-[:checked]:border-primary cursor-pointer transition-all">
<input class="sr-only" name="payment-method" type="radio"/>
<span class="flex-grow font-medium">Credit / Debit Card</span>
<span class="material-symbols-outlined text-muted-light dark:text-muted-dark">credit_card</span>
</label>
</div>
</fieldset>
</div>
<div class="flex items-start gap-4 p-4 rounded-lg bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30">
<span class="material-symbols-outlined text-primary mt-1">shield</span>
<div>
<h3 class="font-bold text-foreground-light dark:text-foreground-dark">Your payment is protected</h3>
<p class="text-sm text-muted-light dark:text-muted-dark mt-1">We use a secure escrow service. We'll hold your payment and only release it to the handyman after you confirm the job is completed to your satisfaction.</p>
</div>
</div>
<div class="pt-4">
<button class="w-full h-12 flex items-center justify-center rounded-lg bg-primary text-background-dark font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                        Confirm &amp; Pay
                    </button>
</div>
</div>
</main>
</div>

</body></html>