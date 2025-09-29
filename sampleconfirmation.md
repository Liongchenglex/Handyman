<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Job Posted Confirmation</title>
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&amp;display=swap" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com?plugins=container-queries"></script>
<style type="text/tailwindcss">
        @layer base {
            :root {
                --primary: #38e07b;
                --background-light: #f6f8f7;
                --background-dark: #122017;
            }
        }
    </style>
<script>
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "primary": "var(--primary)",
                        "background-light": "var(--background-light)",
                        "background-dark": "var(--background-dark)",
                    },
                    fontFamily: {
                        "display": ["Space Grotesk", "sans-serif"]
                    },
                    borderRadius: {
                        "DEFAULT": "0.25rem",
                        "lg": "0.5rem",
                        "xl": "0.75rem",
                        "full": "9999px"
                    },
                },
            },
        }
    </script>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet"/>
</head>
<body class="bg-background-light dark:bg-background-dark font-display text-zinc-900 dark:text-zinc-100">
<div class="min-h-screen flex flex-col items-center justify-center p-4">
<main class="w-full max-w-md mx-auto">
<div class="bg-background-light dark:bg-background-dark shadow-xl rounded-xl p-6 sm:p-8 text-center">
<div class="mb-6 flex justify-center">
<div class="bg-primary/20 dark:bg-primary/30 rounded-full p-4">
<div class="bg-primary/20 dark:bg-primary/30 rounded-full p-3">
<span class="material-symbols-outlined text-primary text-4xl">
                            check
                           </span>
</div>
</div>
</div>
<h1 class="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">Job Posted Successfully!</h1>
<p class="text-zinc-600 dark:text-zinc-400 mb-8">
                    We've sent you a WhatsApp message and an in-app notification with the job details. You'll receive updates from handymen shortly.
                </p>
<a class="w-full inline-block bg-primary text-background-dark font-bold py-3 px-6 rounded-lg hover:bg-primary/90 transition-colors duration-300" href="#">
                    View Job
                </a>
</div>
</main>
</div>

</body></html>