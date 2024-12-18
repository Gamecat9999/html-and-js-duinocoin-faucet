class DuinoFaucet {
    constructor() {
        this.baseUrl = 'https://server.duinocoin.com';
        this.credentials = {
            username: FAUCET_CONFIG.username,
            password: FAUCET_CONFIG.password
        };
        
        // Initialize Supabase
        this.supabase = supabase.createClient(
            'https://appriydjgfkvqlzdwmap.supabase.co',  // Replace with your project URL
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwcHJpeWRqZ2ZrdnFsemR3bWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0ODEwNDQsImV4cCI6MjA1MDA1NzA0NH0.8IMYA4bvOtynP7MAAGPBsw0wl6VkwfbHVl0A40Fb0B8'  // Replace with your anon key
        );
    }

    async isOnCooldown(username) {
        try {
            const { data, error } = await this.supabase
                .from('cooldowns')
                .select('timestamp')
                .eq('username', username)
                .single();

            if (error) {
                console.error('Cooldown check error:', error);
                return false;
            }

            if (!data) return false;

            const now = Date.now();
            const timeLeft = 24 * 60 * 60 * 1000 - (now - data.timestamp);

            if (timeLeft <= 0) {
                await this.deleteCooldown(username);
                return false;
            }

            return {
                onCooldown: true,
                timeLeft: this.formatTimeLeft(timeLeft)
            };
        } catch (error) {
            console.error('Cooldown check error:', error);
            return false;
        }
    }

    async setCooldown(username) {
        try {
            const { error } = await this.supabase
                .from('cooldowns')
                .upsert({ 
                    username: username, 
                    timestamp: Date.now() 
                });

            if (error) {
                console.error('Error setting cooldown:', error);
            }
        } catch (error) {
            console.error('Error setting cooldown:', error);
        }
    }

    async deleteCooldown(username) {
        try {
            const { error } = await this.supabase
                .from('cooldowns')
                .delete()
                .eq('username', username);

            if (error) {
                console.error('Error deleting cooldown:', error);
            }
        } catch (error) {
            console.error('Error deleting cooldown:', error);
        }
    }

    async cleanupCooldowns() {
        try {
            const cutoff = Date.now() - (24 * 60 * 60 * 1000);
            const { error } = await this.supabase
                .from('cooldowns')
                .delete()
                .lt('timestamp', cutoff);

            if (error) {
                console.error('Error cleaning up cooldowns:', error);
            }
        } catch (error) {
            console.error('Error cleaning up cooldowns:', error);
        }
    }

    formatTimeLeft(ms) {
        const hours = Math.floor(ms / (60 * 60 * 1000));
        const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
        return `${hours}h ${minutes}m`;
    }

    generateRandomAmount() {
        return (Math.random() * (5 - 0.01) + 0.01).toFixed(2);
    }

    async getBalance() {
        try {
            const response = await fetch(`${this.baseUrl}/users/${this.credentials.username}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error('Failed to fetch balance');
            }

            let balance;
            if (typeof data.result.balance === 'object') {
                balance = data.result.balance.balance;
            } else if (typeof data.result.balance === 'string') {
                balance = parseFloat(data.result.balance);
            } else {
                balance = data.result.balance;
            }

            return parseFloat(balance).toFixed(2);
        } catch (error) {
            console.error('Balance fetch error:', error);
            throw new Error('Failed to connect to Duino-Coin server');
        }
    }

    async sendTransaction(recipient, amount) {
        try {
            const memo = 'katfaucet';
            const url = `${this.baseUrl}/transaction/?username=${this.credentials.username}&password=${this.credentials.password}&recipient=${recipient}&amount=${amount}&memo=${memo}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Transaction failed');
            }

            return {
                success: true,
                message: data.result || 'Transaction completed successfully'
            };
        } catch (error) {
            console.error('Transaction error:', error);
            return {
                success: false,
                message: error.message || 'Failed to send transaction'
            };
        }
    }
}

async function handleClaim(faucet) {
    const messageDiv = document.getElementById('message');
    const username = document.getElementById('username').value.trim();

    messageDiv.textContent = '';
    messageDiv.className = '';

    try {
        if (!username) {
            throw new Error('Please enter a username!');
        }

        const cooldownCheck = await faucet.isOnCooldown(username);
        if (cooldownCheck && cooldownCheck.onCooldown) {
            throw new Error(`Please wait ${cooldownCheck.timeLeft} before claiming again.`);
        }

        setLoading(true);
        messageDiv.textContent = 'Waiting to Processing transaction...';
        
        const amount = faucet.generateRandomAmount();
        const result = await faucet.sendTransaction(username, amount);

        if (!result.success) {
            throw new Error(result.message);
        }

        await faucet.setCooldown(username);

        messageDiv.className = 'success';
        messageDiv.textContent = `Successfully sent ${amount} DUCO to ${username}!`;
        
        await updateBalance(faucet);

    } catch (error) {
        messageDiv.className = 'error';
        messageDiv.textContent = error.message;
        console.error('Faucet error:', error);
    } finally {
        setLoading(false);
    }
}

function setLoading(isLoading) {
    document.getElementById('loading').style.display = isLoading ? 'block' : 'none';
    document.querySelector('input[type="submit"]').disabled = isLoading;
}

async function updateBalance(faucet) {
    const balanceElement = document.getElementById('faucetBalance');
    try {
        balanceElement.textContent = 'Updating balance...';
        const balance = await faucet.getBalance();
        balanceElement.textContent = `Faucet Balance: ${balance} DUCO`;
    } catch (error) {
        console.error('Balance update error:', error);
        balanceElement.textContent = 'Error loading balance';
    }
}

function initializeFaucet() {
    const faucet = new DuinoFaucet();
    window.faucetInstance = faucet;
    
    const form = document.getElementById('faucetForm');
    
    // Clean up old cooldowns periodically
    faucet.cleanupCooldowns();
    setInterval(() => faucet.cleanupCooldowns(), 60 * 60 * 1000); // Every hour

    // Update balance periodically
    updateBalance(faucet);
    setInterval(() => updateBalance(faucet), 60000); // Every minute

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        await handleClaim(faucet);
    });
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeFaucet();
});
