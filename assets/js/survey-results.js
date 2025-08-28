function checkPasscode() {
    const passcode = document.getElementById('passcode').value;
    const correctPasscode = 'SHOWME'; // Match your form message
    
    if (passcode === correctPasscode) {
        document.getElementById('passcode-form').style.display = 'none';
        document.getElementById('survey-results').style.display = 'block';
        loadSurveyData();
    } else {
        document.getElementById('error-message').style.display = 'block';
    }
}

async function loadSurveyData() {
    try {
        // Add cache-busting parameter for GitHub Pages
        const timestamp = new Date().getTime();
        const response = await fetch(`/data/survey-stats.json?v=${timestamp}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        displayStats(data);
    } catch (error) {
        console.error('Error loading survey data:', error);
        document.getElementById('loading').innerHTML = 'Error loading data. Please try again later.';
    }
}

function displayStats(data) {
    const container = document.getElementById('stats-container');
    const loading = document.getElementById('loading');
    loading.style.display = 'none';
    
    // Show general stats first at the top
    createGeneralStats(data.general);
    
    // Create grid layout for charts with proper constraints
    container.style.cssText = `
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-top: 20px;
        max-width: 100%;
        box-sizing: border-box;
        width: 100%;
    `;
    
    // Add comprehensive responsive styles
    const style = document.createElement('style');
    style.textContent = `
        body {
            max-width: 100vw;
            overflow-x: hidden;
            box-sizing: border-box;
        }
        
        #stats-container {
            max-width: 100%;
            box-sizing: border-box;
            padding: 0 10px;
        }
        
        .chart-container {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e9ecef;
            box-sizing: border-box;
            width: 100%;
            min-width: 0;
            overflow: hidden;
        }
        
        .chart-container canvas {
            max-height: 300px !important;
            width: 100% !important;
            height: auto !important;
        }
        
        .chart-container ol {
            margin: 0;
            padding-left: 18px;
            line-height: 1.4;
            font-size: 14px;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        .chart-container li {
            margin-bottom: 6px;
            word-wrap: break-word;
            overflow-wrap: break-word;
            max-width: 100%;
        }
        
        .chart-container li strong {
            display: inline-block;
            max-width: 100%;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        @media (max-width: 768px) {
            #stats-container {
                grid-template-columns: 1fr !important;
                padding: 0 5px;
            }
            
            .chart-container {
                padding: 12px;
            }
            
            .chart-container h3 {
                font-size: 14px !important;
            }
            
            .chart-container ol {
                font-size: 12px;
                padding-left: 15px;
            }
        }
        
        @media (max-width: 480px) {
            .chart-container {
                padding: 10px;
                margin-bottom: 15px;
            }
            
            .chart-container h3 {
                font-size: 13px !important;
                margin-bottom: 10px;
            }
            
            .chart-container ol {
                font-size: 11px;
            }
            
            #general-stats > div > div:first-child {
                flex-direction: column !important;
                gap: 15px !important;
            }
        }
        
        * {
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        canvas {
            max-width: 100% !important;
            height: auto !important;
        }
    `;
    document.head.appendChild(style);
    
    // Create visualizations for all categories
    createFruitChart(data.fruits);
    createGrapeChart(data.grapes);
    createEggHistogram(data.eggs);
    createSandwichChart(data.sandwiches);
    createTraderJoesChart(data.trader_joes);
    createDrinkChart(data.plane_drinks);
    createPotatoChart(data.potatoes);
    createTacoChart(data.taco_shells);
    createPastaChart(data.pasta_shapes);
}

function createFruitChart(fruitData) {
    const container = document.getElementById('stats-container');
    const chartDiv = document.createElement('div');
    chartDiv.className = 'chart-container';
    
    // Add scrollable wrapper for the chart
    const scrollWrapper = document.createElement('div');
    scrollWrapper.style.cssText = `
        max-height: 400px;
        overflow-y: auto;
        overflow-x: hidden;
        border: 1px solid #e9ecef;
        border-radius: 4px;
        background: white;
    `;
    
    const ctx = document.createElement('canvas');
    ctx.id = 'fruitChart';
    
    // Calculate dynamic height based on number of items
    const itemCount = Object.keys(fruitData).length;
    const minHeight = Math.max(300, itemCount * 25); // 25px per item minimum
    ctx.style.height = `${minHeight}px`;
    
    scrollWrapper.appendChild(ctx);
    chartDiv.appendChild(scrollWrapper);
    container.appendChild(chartDiv);
    
    // Sort fruits by count (descending) for better readability
    const sortedEntries = Object.entries(fruitData)
        .sort(([,a], [,b]) => b - a);
    
    const labels = sortedEntries.map(([fruit, ]) => fruit);
    const data = sortedEntries.map(([, count]) => count);
    
    // Generate a diverse color palette for many fruits
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
        '#FF6384', '#C9CBCF', '#4BC0C0', '#36A2EB', '#FF9F40', '#9966FF',
        '#FFB1C1', '#87CEEB', '#DDA0DD', '#98FB98', '#F0E68C', '#FFA07A',
        '#20B2AA', '#87CEFA', '#DEB887', '#F5DEB3', '#FF69B4', '#CD853F'
    ];
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Votes',
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: colors.slice(0, labels.length).map(color => color + 'CC'),
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // Horizontal bars
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '🍎 Favorite Fruits',
                    font: { size: 16 }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Votes',
                        font: { size: 12 }
                    }
                },
                y: {
                    ticks: {
                        font: { size: 12 }
                    }
                }
            },
            layout: {
                padding: {
                    left: 10,
                    right: 10
                }
            }
        }
    });
}

function createGrapeChart(grapeData) {
    const container = document.getElementById('stats-container');
    const chartDiv = document.createElement('div');
    chartDiv.className = 'chart-container';
    
    const ctx = document.createElement('canvas');
    ctx.id = 'grapeChart';
    chartDiv.appendChild(ctx);
    container.appendChild(chartDiv);
    
    // Map colors to specific grape types
    const colorMapping = {
        'Green': '#32CD32',   // Lime Green
        'Red': '#DC143C',     // Crimson Red
        'Other': '#808080'    // Gray
    };
    
    const labels = Object.keys(grapeData);
    const data = Object.values(grapeData);
    const colors = labels.map(label => colorMapping[label] || '#808080');
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Responses',
                data: data,
                backgroundColor: colors,
                borderColor: colors.map(color => color + 'CC'),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '🍇 Grape Preferences',
                    font: { size: 16 }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Votes',
                        font: { size: 12 }
                    }
                }
            }
        }
    });
}

function createEggHistogram(eggData) {
    const container = document.getElementById('stats-container');
    const chartDiv = document.createElement('div');
    chartDiv.className = 'chart-container';
    
    const ctx = document.createElement('canvas');
    ctx.id = 'eggChart';
    chartDiv.appendChild(ctx);
    container.appendChild(chartDiv);
    
    // Create histogram bins
    const bins = {};
    eggData.data.forEach(value => {
        const bin = Math.floor(value / 10) * 10; // 10-egg bins
        const binLabel = `${bin}-${bin + 9}`;
        bins[binLabel] = (bins[binLabel] || 0) + 1;
    });
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(bins).sort((a, b) => {
                const aNum = parseInt(a.split('-')[0]);
                const bNum = parseInt(b.split('-')[0]);
                return aNum - bNum;
            }),
            datasets: [{
                label: 'Number of People',
                data: Object.values(bins),
                backgroundColor: '#FFD700'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '🥚 Egg Eating Challenge',
                    font: { size: 16 }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Responses',
                        font: { size: 12 }
                    },
                    beginAtZero: true
                },
                x: {
                    title: {
                        display: true,
                        text: 'Eggs',
                        font: { size: 12 }
                    }
                }
            }
        }
    });
    
    // Add stats text below the chart
    const statsText = document.createElement('div');
    statsText.innerHTML = `
        <div style="font-size: 12px; color: #666; margin-top: 10px; text-align: center;">
            Avg: ${eggData.average} | Max: ${eggData.max} | Min: ${eggData.min}
        </div>
    `;
    chartDiv.appendChild(statsText);
}

function createSandwichChart(sandwichData) {
    const container = document.getElementById('stats-container');
    const chartDiv = document.createElement('div');
    chartDiv.className = 'chart-container';
    
    const ctx = document.createElement('canvas');
    ctx.id = 'sandwichChart';
    chartDiv.appendChild(ctx);
    container.appendChild(chartDiv);
    
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(sandwichData),
            datasets: [{
                data: Object.values(sandwichData),
                backgroundColor: ['#8B4513', '#DDA0DD', '#FFB6C1']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '🥪 Sandwich Supremacy',
                    font: { size: 16 }
                },
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 12 } }
                }
            }
        }
    });
}

function createTraderJoesChart(tjData) {
    const container = document.getElementById('stats-container');
    const listDiv = document.createElement('div');
    listDiv.className = 'chart-container';
    
    // Sort by count (descending)
    const sortedEntries = Object.entries(tjData)
        .sort(([,a], [,b]) => b - a);
    
    let listHTML = `
        <h3 style="margin-top: 0; color: #D2691E; font-size: 16px; word-wrap: break-word;">🛒 Trader Joe's Favorites</h3>
        <div style="font-size: 12px; color: #666; margin-bottom: 15px;">
            Ranked by popularity (${sortedEntries.length} unique items)
        </div>
        <div class="scrollable-list">
            <ol style="margin: 0; padding-left: 18px; line-height: 1.4; font-size: 14px;">
    `;
    
    sortedEntries.forEach(([item, count]) => {
        const totalVotes = Object.values(tjData).reduce((a, b) => a + b, 0);
        const percentage = ((count / totalVotes) * 100).toFixed(1);
        
        listHTML += `
            <li style="margin-bottom: 8px; word-wrap: break-word; overflow-wrap: break-word;">
                <strong style="display: block; margin-bottom: 2px;">${item}</strong>
                <span style="color: #D2691E; font-weight: bold; font-size: 12px;">
                    ${count} ${count === 1 ? 'vote' : 'votes'}
                </span>
                <span style="color: #666; font-size: 11px;"> (${percentage}%)</span>
            </li>
        `;
    });
    
    listHTML += `
            </ol>
        </div>
    `;
    
    listDiv.innerHTML = listHTML;
    container.appendChild(listDiv);
}

function createDrinkChart(drinkData) {
    const container = document.getElementById('stats-container');
    const listDiv = document.createElement('div');
    listDiv.className = 'chart-container';
    
    // Sort by count (descending)
    const sortedEntries = Object.entries(drinkData)
        .sort(([,a], [,b]) => b - a);
    
    let listHTML = `
        <h3 style="margin-top: 0; color: #2C5F7F; font-size: 16px; word-wrap: break-word;">✈️ Airplane Drinks</h3>
        <div style="font-size: 12px; color: #666; margin-bottom: 15px;">
            Ranked by popularity (${sortedEntries.length} drink types)
        </div>
        <div class="scrollable-list">
            <ol style="margin: 0; padding-left: 18px; line-height: 1.4; font-size: 14px;">
    `;
    
    sortedEntries.forEach(([drink, count]) => {
        const totalVotes = Object.values(drinkData).reduce((a, b) => a + b, 0);
        const percentage = ((count / totalVotes) * 100).toFixed(1);
        
        listHTML += `
            <li style="margin-bottom: 8px; word-wrap: break-word; overflow-wrap: break-word;">
                <strong style="display: block; margin-bottom: 2px;">${drink}</strong>
                <span style="color: #2C5F7F; font-weight: bold; font-size: 12px;">
                    ${count} ${count === 1 ? 'vote' : 'votes'}
                </span>
                <span style="color: #666; font-size: 11px;"> (${percentage}%)</span>
            </li>
        `;
    });
    
    listHTML += `
            </ol>
        </div>
    `;
    
    listDiv.innerHTML = listHTML;
    container.appendChild(listDiv);
}

function createPotatoChart(potatoData) {
    const container = document.getElementById('stats-container');
    const chartDiv = document.createElement('div');
    chartDiv.className = 'chart-container';
    
    const ctx = document.createElement('canvas');
    ctx.id = 'potatoChart';
    chartDiv.appendChild(ctx);
    container.appendChild(chartDiv);
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(potatoData),
            datasets: [{
                label: 'Votes',
                data: Object.values(potatoData),
                backgroundColor: '#DAA520'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '🍟 Fried Potato Battle',
                    font: { size: 16 }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Votes',
                        font: { size: 12 }
                    }
                },
                x: {
                    ticks: {
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

function createTacoChart(tacoData) {
    const container = document.getElementById('stats-container');
    const chartDiv = document.createElement('div');
    chartDiv.className = 'chart-container';
    
    const ctx = document.createElement('canvas');
    ctx.id = 'tacoChart';
    chartDiv.appendChild(ctx);
    container.appendChild(chartDiv);
    
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(tacoData),
            datasets: [{
                data: Object.values(tacoData),
                backgroundColor: ['#D2691E', '#F0E68C', '#DEB887']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '🌮 Taco Shell Showdown',
                    font: { size: 16 }
                },
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 12 } }
                }
            }
        }
    });
}

function createPastaChart(pastaData) {
    const container = document.getElementById('stats-container');
    const chartDiv = document.createElement('div');
    chartDiv.className = 'chart-container';
    
    const ctx = document.createElement('canvas');
    ctx.id = 'pastaChart';
    chartDiv.appendChild(ctx);
    container.appendChild(chartDiv);
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(pastaData),
            datasets: [{
                label: 'Votes',
                data: Object.values(pastaData),
                backgroundColor: '#F4A460'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '🍝 Pasta Shape Preferences',
                    font: { size: 16 }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Votes',
                        font: { size: 12 }
                    }
                },
                x: {
                    ticks: {
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

function createGeneralStats(generalData) {
    const statsContainer = document.getElementById('general-stats');
    statsContainer.innerHTML = `
        <div style="
            text-align: center; 
            margin: 20px 0 30px 0; 
            padding: 25px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 100%;
            box-sizing: border-box;
        ">
            <h2 style="margin: 0 0 15px 0; font-size: clamp(18px, 4vw, 24px); word-wrap: break-word;">📈 Survey Overview</h2>
            <div style="
                display: flex; 
                justify-content: space-around; 
                flex-wrap: wrap; 
                gap: 20px;
                align-items: center;
            ">
                <div style="min-width: 120px;">
                    <div style="font-size: clamp(24px, 6vw, 32px); font-weight: bold; margin-bottom: 5px;">
                        ${generalData.total_responses}
                    </div>
                    <div style="font-size: 14px; opacity: 0.9;">Total Responses</div>
                </div>
                <div style="min-width: 120px;">
                    <div style="font-size: clamp(14px, 3vw, 16px); font-weight: bold; margin-bottom: 5px; word-wrap: break-word;">
                        ${generalData.last_updated}
                    </div>
                    <div style="font-size: 14px; opacity: 0.9;">Last Updated</div>
                </div>
            </div>
        </div>
    `;
}