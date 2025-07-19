// script.js

// Global variable to store company data
let allCompanies = [];
let filteredCompanies = [];
let currentPage = 1;
const rowsPerPage = 10;

document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggle Logic
    const themeToggle = document.getElementById('checkbox');
    const body = document.body;

    // Check for saved theme preference
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme) {
        body.classList.add(currentTheme);
        if (currentTheme === 'dark-mode') {
            themeToggle.checked = true;
        }
    }

    themeToggle.addEventListener('change', () => {
        if (themeToggle.checked) {
            body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark-mode');
            // Notify iframes about theme change
            document.querySelectorAll('.chart-iframe').forEach(iframe => {
                iframe.contentWindow.postMessage('dark-mode', '*');
            });
        } else {
            body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light-mode');
            // Notify iframes about theme change
            document.querySelectorAll('.chart-iframe').forEach(iframe => {
                iframe.contentWindow.postMessage('light-mode', '*');
            });
        }
    });

    // Sidebar Active Link Logic
    const navLinks = document.querySelectorAll('.side-nav-link');
    const currentPath = window.location.pathname.split('/').pop();
    const currentHash = window.location.hash.substring(1);

    navLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        if (linkHref) {
            const linkPath = linkHref.split('/').pop().split('#')[0];
            const linkHash = linkHref.split('#')[1];

            if (currentPath === 'index.html' && linkPath === 'index.html') {
                if (linkHash === currentHash) {
                    link.classList.add('active');
                } else if (!currentHash && linkHash === 'overview-main') {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            } else {
                link.classList.remove('active');
            }
        } else if (link.tagName === 'BUTTON') {
            link.classList.remove('active');
        }
    });
    
    // Initial Dashboard Tab Display on Load
    if (currentPath === 'index.html') {
        const hash = window.location.hash.substring(1);
        if (hash && document.getElementById(hash)) {
            showMainTab(hash);
        } else {
            showMainTab('overview-main');
        }
    }
    
    // Load Company Data and Render List
    loadCompanyData();
});

function showMainTab(tabId) {
    // Hide all main tab contents
    const mainTabs = document.querySelectorAll('.main-tab-content');
    mainTabs.forEach(tab => tab.classList.remove('active'));
    
    // Show the selected main tab content
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // Update active class in sidebar navigation
    const navLinks = document.querySelectorAll('.side-nav .side-nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');

        if (link.tagName === 'BUTTON' && link.getAttribute('onclick') && 
            link.getAttribute('onclick').includes(`'${tabId}'`)) {
            link.classList.add('active');
        }
        else if (link.tagName === 'A' && link.getAttribute('href') && 
                link.getAttribute('href').includes(`#${tabId}`)) {
            link.classList.add('active');
        }
    });
    
    // Update URL hash for dashboard internal tabs
    if (window.location.pathname.endsWith('index.html')) {
        history.replaceState(null, '', `#${tabId}`);
    }

    // If showing company list, re-render it
    if (tabId === 'companylist') {
        renderCompanyList();
    }
}

async function loadCompanyData() {
    try {
        const response = await fetch('top_1000_firms.xlsx - Data.csv');
        const csvText = await response.text();
        allCompanies = parseCSV(csvText);
        filteredCompanies = [...allCompanies];
        renderCompanyList();
    } catch (error) {
        console.error('Error loading company data:', error);
        document.getElementById('companyTable').querySelector('tbody').innerHTML = 
            '<tr><td colspan="4">Error loading company data.</td></tr>';
    }
}

function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(header => header.trim());
    const companies = [];

    const companyNameCol = headers.indexOf('Company Name');
    const sectorCol = headers.indexOf('Sector');
    const firmTypeCol = headers.indexOf('Firm Type');
    const sales2021Col = headers.indexOf('Gross Sales (2021)');

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);

        if (values.length > Math.max(companyNameCol, sectorCol, firmTypeCol, sales2021Col)) {
            const companyName = values[companyNameCol] || 'N/A';
            const sector = values[sectorCol] || 'N/A';
            const firmType = values[firmTypeCol] || 'N/A';
            let sales2021 = parseFloat(values[sales2021Col]) || 0;
            sales2021 = (sales2021 / 1000000000).toFixed(2);

            companies.push({ companyName, sector, firmType, sales2021: parseFloat(sales2021) });
        }
    }

    return companies.sort((a, b) => b.sales2021 - a.sales2021);
}

function parseCSVLine(line) {
    const result = [];
    let inQuote = false;
    let currentField = '';
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            result.push(currentField.trim());
            currentField = '';
        } else {
            currentField += char;
        }
    }
    result.push(currentField.trim());
    return result;
}

function renderCompanyList() {
    const tableBody = document.getElementById('companyTable').querySelector('tbody');
    tableBody.innerHTML = '';

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const companiesToDisplay = filteredCompanies.slice(startIndex, endIndex);

    companiesToDisplay.forEach(company => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = company.companyName;
        row.insertCell().textContent = company.sector;
        row.insertCell().textContent = company.firmType;
        row.insertCell().textContent = `${company.sales2021.toLocaleString()}B`;
    });

    updatePaginationControls();
}

function filterCompanyList() {
    const searchTerm = document.getElementById('companySearch').value.toLowerCase();
    const sectorFilter = document.getElementById('sectorFilter').value;
    const firmTypeFilter = document.getElementById('firmTypeFilter').value;

    filteredCompanies = allCompanies.filter(company => {
        const matchesSearch = company.companyName.toLowerCase().includes(searchTerm);
        const matchesSector = sectorFilter === '' || company.sector === sectorFilter;
        const matchesFirmType = firmTypeFilter === '' || company.firmType === firmTypeFilter;
        return matchesSearch && matchesSector && matchesFirmType;
    });

    currentPage = 1;
    renderCompanyList();
}

function updatePaginationControls() {
    const totalPages = Math.ceil(filteredCompanies.length / rowsPerPage);
    document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages || 1}`;
    document.querySelector('#pagination-controls button:first-child').disabled = currentPage === 1;
    document.querySelector('#pagination-controls button:last-child').disabled = currentPage === totalPages || totalPages === 0;
}

function nextPage() {
    const totalPages = Math.ceil(filteredCompanies.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderCompanyList();
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderCompanyList();
    }
}

function generateForecast() {
    console.log('Generating forecast...');
    const forecastType = document.getElementById('forecast-type').value;
    const forecastYears = document.getElementById('forecast-years').value;
    const forecastTarget = document.getElementById('forecast-target').value;

    console.log(`Forecast Type: ${forecastType}, Years: ${forecastYears}, Target: ${forecastTarget}`);

    // Dummy data for forecast chart
    const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
    const sales = [7000, 7200, 7100, 7500, 7800, 8100, 8400, 8700, 9000];

    const trace = {
        x: years,
        y: sales,
        mode: 'lines+markers',
        name: 'Projected Sales',
        line: { color: 'var(--harvard-crimson)' }
    };

    const layout = {
        title: {
            text: 'Projected National Sales Over Time',
            font: { color: getComputedStyle(document.documentElement).getPropertyValue('--primary-navy') }
        },
        xaxis: {
            title: 'Year',
            tickvals: years,
            tickmode: 'array',
            automargin: true,
            tickfont: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-dark') },
            gridcolor: 'rgba(0,0,0,0.1)'
        },
        yaxis: {
            title: 'Sales (in Billions P)',
            automargin: true,
            tickfont: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-dark') },
            gridcolor: 'rgba(0,0,0,0.1)'
        },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        margin: { t: 50, b: 50, l: 60, r: 20 },
        hovermode: 'closest',
        font: {
            family: "Segoe UI, sans-serif"
        }
    };

    const config = { responsive: true };
    Plotly.newPlot('forecast-chart', [trace], layout, config);
}
