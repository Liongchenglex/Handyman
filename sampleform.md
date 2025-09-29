Personal details form:
<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>FixIt - Your Details</title>
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&amp;display=swap" rel="stylesheet"/>
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
<style>
    .material-symbols-outlined {
      font-variation-settings:
        'FILL' 0,
        'wght' 400,
        'GRAD' 0,
        'opsz' 24
    }
  </style>
</head>
<body class="bg-background-light dark:bg-background-dark font-display text-gray-800 dark:text-gray-200">
<div class="flex flex-col min-h-screen">
<header class="sticky top-0 z-10 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
<nav class="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
<div class="flex items-center gap-2">
<div class="text-primary w-8 h-8">
<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<path d="M22 9.452V5.5C22 4.122 20.879 3 19.5 3H4.5C3.121 3 2 4.122 2 5.5v13C2 19.878 3.121 21 4.5 21h15c1.379 0 2.5-1.122 2.5-2.5v-3.952l-5.694-1.785a.75.75 0 0 1-.506-.889l.868-2.605a1.5 1.5 0 0 0-1.379-1.956L14 9.17l-1.07-3.21a.75.75 0 0 0-1.42.474l.868 2.605a1.5 1.5 0 0 1-1.378 1.956l-5.183.864a.75.75 0 0 0-.506.889L7 14.535V16H5v-2l1.62-4.05a2.25 2.25 0 0 1 2.068-1.579L12 7.79l1.18-.354a2.25 2.25 0 0 1 2.068 1.579l1.62 4.05H18.5a.5.5 0 0 1 .5.5v2h-2v-1.465l-1.62-4.05a.75.75 0 0 0-.69-.526L12 9.29l-1.18.354a.75.75 0 0 0-.69.526L8.515 14H7v2h2v-1.535l.81-2.025 4.318-.72a.75.75 0 0 0 .69-.526l.868-2.605a2.25 2.25 0 0 1 2.068-1.579L19.43 7l1.07 3.21a.75.75 0 0 1-.69.964L14 11.83l-1.18.354a2.25 2.25 0 0 0-2.068 1.58l-.81 2.024H11.5a.5.5 0 0 1 .5.5v2h2v-2a.5.5 0 0 1 .5-.5h1.58l.81-2.025a.75.75 0 0 0-.69-.965L12 10.79l-1.18-.354a.75.75 0 0 1-.69-.526L8.515 5H19.5c.275 0 .5.225.5.5v3.952l2 2.001Z"></path>
</svg>
</div>
<h1 class="text-xl font-bold text-gray-900 dark:text-white">FixIt</h1>
</div>
<div class="flex items-center gap-4">
<button class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800">
<span class="material-symbols-outlined text-gray-600 dark:text-gray-400">help</span>
</button>
<div class="w-10 h-10 rounded-full bg-cover bg-center" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBGX1hja1o6upXzu34mJ2YZ6y8c-YTlGnFpu4d5h9NmugMmaXnnl5pIMbUxW12POEOxy_ZtB2Xmj_trZmXYNNuTD59UyEUIcOMv0_5R45R6KVqPgkVcLN-ipKEvkSQ2phjSRoTUTIaqrMNnyOBYFdd2X_yhPKcihWVu5DpK7Ix8TsfFRcXaHKMFBZyfaDaY20QxBq2cbk9BA5HF1EESErr_BKTLYirkXthUbzp9WpQrcjGECD2fzbWdv1bUny5y-lc7xq86vvYdnpaT");'></div>
</div>
</nav>
</header>
<main class="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
<div class="max-w-md mx-auto">
<div class="mb-8 text-center">
<h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Let's get started</h2>
<p class="text-gray-500 dark:text-gray-400">First, we need a few details to create your job request.</p>
</div>
<div class="space-y-6">
<div>
<label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2" for="customer-name">Full Name</label>
<input class="w-full h-12 bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-700 rounded-lg p-4 font-bold focus:ring-2 focus:ring-primary/50 focus:border-primary dark:placeholder-gray-500 transition-shadow" id="customer-name" placeholder="e.g., John Doe" type="text"/>
</div>
<div>
<label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2" for="customer-email">Email Address</label>
<input class="w-full h-12 bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-700 rounded-lg p-4 font-bold focus:ring-2 focus:ring-primary/50 focus:border-primary dark:placeholder-gray-500 transition-shadow" id="customer-email" placeholder="e.g., john.doe@example.com" type="email"/>
</div>
<div>
<label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2" for="customer-phone">Phone Number</label>
<input class="w-full h-12 bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-700 rounded-lg p-4 font-bold focus:ring-2 focus:ring-primary/50 focus:border-primary dark:placeholder-gray-500 transition-shadow" id="customer-phone" placeholder="e.g., 9123 4567" type="tel"/>
</div>
</div>
<div class="mt-12">
<button class="w-full h-12 px-5 bg-primary text-gray-900 font-bold text-base rounded-lg shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-background-dark transition-colors">
            Continue
          </button>
</div>
</div>
</main>
</div>

</body></html>



Job description form:
<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<link crossorigin="" href="https://fonts.gstatic.com/" rel="preconnect"/>
<link as="style" href="https://fonts.googleapis.com/css2?display=swap&amp;family=Noto+Sans%3Awght%40400%3B500%3B700%3B900&amp;family=Space+Grotesk%3Awght%40400%3B500%3B700" onload="this.rel='stylesheet'" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script>
    tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
          colors: {
            primary: "#38e07b",
            "background-light": "#f6f8f7",
            "background-dark": "#122017",
          },
          fontFamily: {
            display: ["Space Grotesk"],
          },
          borderRadius: {
            DEFAULT: "0.25rem",
            lg: "0.5rem",
            xl: "0.75rem",
            full: "9999px"
          },
        },
      },
    };
  </script>
<title>FixIt - Service Details</title>
<link href="data:image/x-icon;base64," rel="icon" type="image/x-icon"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet"/>
</head>
<body class="font-display bg-background-light dark:bg-background-dark text-black dark:text-white">
<div class="flex flex-col min-h-screen">
<header class="flex items-center justify-between whitespace-nowrap border-b border-black/10 dark:border-white/10 px-4 sm:px-10 py-3">
<div class="flex items-center gap-4">
<div class="size-6 text-primary">
<svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
<path d="M24 45.8096C19.6865 45.8096 15.4698 44.5305 11.8832 42.134C8.29667 39.7376 5.50128 36.3314 3.85056 32.3462C2.19985 28.361 1.76794 23.9758 2.60947 19.7452C3.451 15.5145 5.52816 11.6284 8.57829 8.5783C11.6284 5.52817 15.5145 3.45101 19.7452 2.60948C23.9758 1.76795 28.361 2.19986 32.3462 3.85057C36.3314 5.50129 39.7376 8.29668 42.134 11.8833C44.5305 15.4698 45.8096 19.6865 45.8096 24L24 24L24 45.8096Z" fill="currentColor"></path>
</svg>
</div>
<h2 class="text-xl font-bold">FixIt</h2>
</div>
<div class="flex items-center gap-4">
<button class="flex items-center justify-center size-10 rounded-full bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60">
<svg fill="currentColor" height="20px" viewBox="0 0 256 256" width="20px" xmlns="http://www.w3.org/2000/svg">
<path d="M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"></path>
</svg>
</button>
<div class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuAG1vRUe9WYxUGHWzi9hTxr5B92LfuucPxzfaqjGm6fpZKtURjD2ITXgD4TXxOOuutF7CCFVI6xjiXOh8n-DVcmzIpSARLhZwDGyvQpnhaR3teLdyGKu0pUjAT8v9cxgY9-zbHehJ6KzNtfs7G-g8UGPkkTNOGI0vtb1BP_NpF7rTMsfmwI7WwuFUEUL7p3pUuMKA0T-gjENiUvu56fjZSTNSLatMY9Ehlmkwk4WfJXKk0c8S5hiCt4Hgu7U-OqlEcBSGThdGi8unrr");'></div>
</div>
</header>
<main class="flex-1 flex justify-center py-8 px-4 sm:px-6">
<div class="w-full max-w-2xl space-y-8">
<div class="text-center sm:text-left">
<h1 class="text-3xl sm:text-4xl font-bold tracking-tight">What do you need help with?</h1>
</div>
<div class="relative bg-background-light dark:bg-background-dark p-1 rounded-lg border border-black/10 dark:border-white/10 flex items-center">
<div class="absolute inset-0 m-1 w-1/2 bg-primary rounded-md transition-transform duration-300 transform" id="toggle-bg"></div>
<button class="relative z-10 w-1/2 py-2 text-center text-black font-semibold rounded-md flex items-center justify-center gap-2" id="ai-btn">
<span class="material-symbols-outlined">auto_awesome</span>
            AI-Powered
          </button>
<button class="relative z-10 w-1/2 py-2 text-center text-black/60 dark:text-white/60 font-semibold rounded-md flex items-center justify-center gap-2" id="manual-btn">
<span class="material-symbols-outlined">edit_document</span>
            Manual Form
          </button>
</div>
<div class="space-y-6">
<div class="space-y-4">
<h3 class="text-lg font-bold">Your Details</h3>
<div class="grid sm:grid-cols-2 gap-4">
<div>
<label class="block text-sm font-medium text-black/80 dark:text-white/80 mb-1" for="name">Name</label>
<input class="w-full p-3 rounded-lg border border-black/10 dark:border-white/10 bg-background-light dark:bg-background-dark focus:border-primary focus:ring-primary focus:ring-2 placeholder:text-black/40 dark:placeholder:text-white/40" id="name" name="name" placeholder="e.g. John Doe" type="text"/>
</div>
<div>
<label class="block text-sm font-medium text-black/80 dark:text-white/80 mb-1" for="email">Email</label>
<input class="w-full p-3 rounded-lg border border-black/10 dark:border-white/10 bg-background-light dark:bg-background-dark focus:border-primary focus:ring-primary focus:ring-2 placeholder:text-black/40 dark:placeholder:text-white/40" id="email" name="email" placeholder="e.g. john.doe@example.com" type="email"/>
</div>
<div class="sm:col-span-2">
<label class="block text-sm font-medium text-black/80 dark:text-white/80 mb-1" for="phone">Phone Number</label>
<input class="w-full p-3 rounded-lg border border-black/10 dark:border-white/10 bg-background-light dark:bg-background-dark focus:border-primary focus:ring-primary focus:ring-2 placeholder:text-black/40 dark:placeholder:text-white/40" id="phone" name="phone" placeholder="e.g. +65 9123 4567" type="tel"/>
</div>
</div>
</div>
<hr class="border-black/10 dark:border-white/10"/>
<div class="space-y-4">
<h3 class="text-lg font-bold">Select a category</h3>
<div class="flex flex-wrap gap-3">
<label class="relative cursor-pointer">
<input class="sr-only peer" name="category" type="radio"/>
<div class="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-black/80 dark:text-white/80 peer-checked:bg-primary peer-checked:text-black peer-checked:border-primary">
                  Plumbing
                </div>
</label>
<label class="relative cursor-pointer">
<input class="sr-only peer" name="category" type="radio"/>
<div class="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-black/80 dark:text-white/80 peer-checked:bg-primary peer-checked:text-black peer-checked:border-primary">
                  Electrical
                </div>
</label>
<label class="relative cursor-pointer">
<input checked="" class="sr-only peer" name="category" type="radio"/>
<div class="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-black/80 dark:text-white/80 peer-checked:bg-primary peer-checked:text-black peer-checked:border-primary">
                  Carpentry
                </div>
</label>
<label class="relative cursor-pointer">
<input class="sr-only peer" name="category" type="radio"/>
<div class="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-black/80 dark:text-white/80 peer-checked:bg-primary peer-checked:text-black peer-checked:border-primary">
                  Appliance Repair
                </div>
</label>
<label class="relative cursor-pointer">
<input class="sr-only peer" name="category" type="radio"/>
<div class="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-black/80 dark:text-white/80 peer-checked:bg-primary peer-checked:text-black peer-checked:border-primary">
                  Painting
                </div>
</label>
</div>
</div>
<div class="space-y-4">
<h3 class="text-lg font-bold">When do you need the service?</h3>
<div class="flex flex-wrap gap-3">
<label class="relative cursor-pointer">
<input class="sr-only peer" name="timing" type="radio"/>
<div class="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-black/80 dark:text-white/80 peer-checked:bg-primary peer-checked:text-black peer-checked:border-primary">
                  Immediate
                </div>
</label>
<label class="relative cursor-pointer">
<input checked="" class="sr-only peer" name="timing" type="radio"/>
<div class="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-black/80 dark:text-white/80 peer-checked:bg-primary peer-checked:text-black peer-checked:border-primary">
                  Schedule
                </div>
</label>
</div>
</div>
<div class="grid sm:grid-cols-2 gap-6 items-start">
<div class="bg-background-light dark:bg-background-dark p-4 rounded-lg border border-black/10 dark:border-white/10">
<div class="flex items-center justify-between mb-4">
<button class="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
<svg fill="currentColor" height="18px" viewBox="0 0 256 256" width="18px" xmlns="http://www.w3.org/2000/svg">
<path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"></path>
</svg>
</button>
<p class="text-base font-bold">October 2024</p>
<button class="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
<svg fill="currentColor" height="18px" viewBox="0 0 256 256" width="18px" xmlns="http://www.w3.org/2000/svg">
<path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"></path>
</svg>
</button>
</div>
<div class="grid grid-cols-7 text-center text-sm">
<div class="font-bold text-black/50 dark:text-white/50 py-2">S</div>
<div class="font-bold text-black/50 dark:text-white/50 py-2">M</div>
<div class="font-bold text-black/50 dark:text-white/50 py-2">T</div>
<div class="font-bold text-black/50 dark:text-white/50 py-2">W</div>
<div class="font-bold text-black/50 dark:text-white/50 py-2">T</div>
<div class="font-bold text-black/50 dark:text-white/50 py-2">F</div>
<div class="font-bold text-black/50 dark:text-white/50 py-2">S</div>
<div class="col-start-3 p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">1</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">2</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">3</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">4</button></div>
<div class="p-1">
<button class="w-full h-8 flex items-center justify-center rounded-full bg-primary text-black font-bold">5</button>
</div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">6</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">7</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">8</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">9</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">10</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">11</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">12</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">13</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">14</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">15</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">16</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">17</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">18</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">19</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">20</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">21</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">22</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">23</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">24</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">25</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">26</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">27</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">28</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">29</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">30</button></div>
<div class="p-1"><button class="w-full h-8 flex items-center justify-center rounded-full hover:bg-primary/20">31</button></div>
</div>
</div>
<div class="space-y-4">
<label class="text-lg font-bold" for="time">Select time</label>
<select class="w-full p-3 rounded-lg border border-black/10 dark:border-white/10 bg-background-light dark:bg-background-dark focus:border-primary focus:ring-primary focus:ring-2" id="time">
<option>09:00 AM - 11:00 AM</option>
<option>11:00 AM - 01:00 PM</option>
<option>01:00 PM - 03:00 PM</option>
<option>03:00 PM - 05:00 PM</option>
</select>
<p class="text-sm text-black/60 dark:text-white/60">Surcharges may apply for scheduled times.</p>
</div>
</div>
<div class="space-y-4">
<h3 class="text-lg font-bold">Materials</h3>
<div class="flex flex-wrap gap-3">
<label class="relative cursor-pointer">
<input checked="" class="sr-only peer" name="materials" type="radio"/>
<div class="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-black/80 dark:text-white/80 peer-checked:bg-primary peer-checked:text-black peer-checked:border-primary">
                  I will buy
                </div>
</label>
<label class="relative cursor-pointer">
<input class="sr-only peer" name="materials" type="radio"/>
<div class="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-black/80 dark:text-white/80 peer-checked:bg-primary peer-checked:text-black peer-checked:border-primary">
                  Handyman to buy (surcharge applies)
                </div>
</label>
</div>
</div>
<div class="space-y-4">
<h3 class="text-lg font-bold">Site Visit</h3>
<div class="flex flex-wrap gap-3">
<label class="relative cursor-pointer">
<input class="sr-only peer" name="site-visit" type="radio"/>
<div class="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-black/80 dark:text-white/80 peer-checked:bg-primary peer-checked:text-black peer-checked:border-primary">
                  Yes
                </div>
</label>
<label class="relative cursor-pointer">
<input checked="" class="sr-only peer" name="site-visit" type="radio"/>
<div class="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-black/80 dark:text-white/80 peer-checked:bg-primary peer-checked:text-black peer-checked:border-primary">
                  No
                </div>
</label>
</div>
</div>
<div class="space-y-4">
<label class="text-lg font-bold" for="notes">Notes (optional)</label>
<textarea class="w-full p-3 rounded-lg border border-black/10 dark:border-white/10 bg-background-light dark:bg-background-dark focus:border-primary focus:ring-primary focus:ring-2 placeholder:text-black/40 dark:placeholder:text-white/40" id="notes" placeholder="Describe the issue, e.g., 'Leaky pipe under the kitchen sink.'" rows="4"></textarea>
</div>
</div>
<div class="pt-4">
<button class="w-full bg-primary text-black font-bold text-lg py-3 px-5 rounded-lg hover:bg-opacity-80 transition-colors">
            Find Handyman
          </button>
</div>
</div>
</main>
</div>
<script>
    const aiBtn = document.getElementById('ai-btn');
    const manualBtn = document.getElementById('manual-btn');
    const toggleBg = document.getElementById('toggle-bg');
    aiBtn.addEventListener('click', () => {
      toggleBg.style.transform = 'translateX(0%)';
      aiBtn.classList.remove('text-black/60', 'dark:text-white/60');
      aiBtn.classList.add('text-black');
      manualBtn.classList.add('text-black/60', 'dark:text-white/60');
      manualBtn.classList.remove('text-black');
    });
    manualBtn.addEventListener('click', () => {
      toggleBg.style.transform = 'translateX(100%)';
      manualBtn.classList.remove('text-black/60', 'dark:text-white/60');
      manualBtn.classList.add('text-black');
      aiBtn.classList.add('text-black/60', 'dark:text-white/60');
      aiBtn.classList.remove('text-black');
    });
  </script>

</body></html>