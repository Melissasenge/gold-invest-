const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

let users = [];
let deposits = [];

// INSCRIPTION (Bonus 2000F)
app.post('/api/register', (req, res) => {
    const { username, password, referralCode } = req.body;
    const newUser = { id: users.length + 1, username, password, balance: 0, referralCode: "GOLD-" + Math.random().toString(36).substr(2, 5).toUpperCase(), status: 'Actif' };
    if (referralCode) {
        const ref = users.find(u => u.referralCode === referralCode);
        if (ref) ref.balance += 2000;
    }
    users.push(newUser);
    res.json(newUser);
});

// LOGIN
app.post('/api/login', (req, res) => {
    const user = users.find(u => u.username === req.body.username && u.password === req.body.password);
    if (user) res.json(user); else res.status(401).send();
});

// DÉPÔT (Client)
app.post('/api/deposit-request', (req, res) => {
    const newDep = { ...req.body, id: Date.now().toString() }; // On force un ID en string
    deposits.push(newDep);
    res.json({ message: "OK" });
});

// VALIDATION (Admin) - CORRIGÉ
app.post('/api/admin/confirm-deposit', (req, res) => {
    const { depId } = req.body;
    const idx = deposits.findIndex(d => d.id === depId);
    if (idx > -1) {
        const dep = deposits[idx];
        const user = users.find(u => u.id == dep.userId);
        if (user) {
            user.balance += parseInt(dep.amount);
            deposits.splice(idx, 1);
            return res.json({ success: true });
        }
    }
    res.status(404).json({ error: "Dépôt non trouvé" });
});

// AJOUT MANUEL (Admin)
app.post('/api/admin/update-balance', (req, res) => {
    const { userId, newBalance, isAdd } = req.body;
    const user = users.find(u => u.id == userId);
    if (user) {
        user.balance = isAdd ? (user.balance + parseInt(newBalance)) : parseInt(newBalance);
        res.json({ success: true });
    } else { res.status(404).send(); }
});

// BAN (Admin)
app.post('/api/admin/ban', (req, res) => {
    const user = users.find(u => u.id == req.body.userId);
    if (user) { user.status = (user.status === 'Banni') ? 'Actif' : 'Banni'; res.json({ success: true }); }
});

// SYNC DATA
app.get('/api/user-data/:id', (req, res) => res.json(users.find(u => u.id == req.params.id) || {balance: 0}));
app.get('/api/admin/users', (req, res) => res.json(users));
app.get('/api/admin/deposits', (req, res) => res.json(deposits));
app.get('/api/check-weekend', (req, res) => res.json({ canWithdraw: true }));

app.listen(3000, () => console.log("🚀 SERVEUR REPARÉ SUR LE PORT 3000"));
// Modifie la route /api/invest dans ton server.js
app.post('/api/invest', (req, res) => {
    const { userId, amount } = req.body;
    const PLANS = { 3000: 500, 10000: 2000, 25000: 6000, 75000: 20000, 150000: 45000 };
    const user = users.find(u => u.id == userId);
    
    if (user && user.balance >= amount) {
        user.balance -= amount;
        // On enregistre le plan actif
        user.activePlan = {
            name: amount == 3000 ? "Plan Star" : "Plan Pro",
            investment: amount,
            profit: PLANS[amount],
            date: new Date().toLocaleDateString('fr-FR')
        };
        res.json({ newBalance: user.balance, activePlan: user.activePlan });
    } else {
        res.status(400).json({ error: "Solde insuffisant" });
    }
});
// Ajoute ces routes dans ton server.js
app.post('/api/start-mine', (req, res) => {
    const user = users.find(u => u.id == req.body.userId);
    if (user) {
        const now = Date.now();
        // Vérifier si 24h sont passées (86400000 ms)
        if (user.lastMine && (now - user.lastMine < 86400000)) {
            return res.status(400).json({ error: "Minage déjà en cours !" });
        }
        user.lastMine = now;
        res.json({ success: true, startTime: user.lastMine });
    }
});

app.post('/api/claim-mine', (req, res) => {
    const user = users.find(u => u.id == req.body.userId);
    if (user && user.lastMine) {
        const now = Date.now();
        if (now - user.lastMine >= 86400000) { // 24h pile
            const gain = user.activePlan ? user.activePlan.profit : 100; // Gain par défaut si pas de plan
            user.balance += gain;
            user.lastMine = null; // Réinitialise
            res.json({ success: true, newBalance: user.balance });
        } else {
            res.status(400).json({ error: "Minage non terminé !" });
        }
    }
});
// Ajoute ces variables et routes dans ton server.js
let dailyBonuses = []; 

// 1. Logique des RANGS VIP (Automatique selon parrainages)
const getRank = (refCount) => {
    if (refCount >= 20) return { name: "GOLD BOSS", bonus: 2500, color: "#ffcc00" };
    if (refCount >= 5) return { name: "SILVER", bonus: 2200, color: "#c0c0c0" };
    return { name: "BRONZE", bonus: 2000, color: "#cd7f32" };
};

// 2. Route Bonus Quotidien (50 F)
app.post('/api/daily-bonus', (req, res) => {
    const user = users.find(u => u.id == req.body.userId);
    const today = new Date().toLocaleDateString();
    const key = user.id + today;

    if (dailyBonuses.includes(key)) return res.status(400).json({ error: "Déjà récupéré aujourd'hui !" });
    
    user.balance += 50;
    dailyBonuses.push(key);
    res.json({ newBalance: user.balance, message: "50 FCFA ajoutés !" });
});

// 3. Route Roue de la Fortune (Gains aléatoires)
app.post('/api/spin-wheel', (req, res) => {
    const user = users.find(u => u.id == req.body.userId);
    const gains = [0, 50, 100, 200, 500, 1000];
    const win = gains[Math.floor(Math.random() * gains.length)];
    
    user.balance += win;
    res.json({ win, newBalance: user.balance });
});

// Modifier la route user-data pour inclure le rang
app.get('/api/user-data/:id', (req, res) => {
    const user = users.find(u => u.id == req.params.id);
    if(user) {
        const refs = users.filter(u => u.referredBy == user.referralCode).length;
        user.rank = getRank(refs);
    }
    res.json(user || {});
});
// Ajoute cette route dans ton server.js pour calculer le top 10
app.get('/api/leaderboard', (req, res) => {
    const topTen = users.map(u => {
        const refCount = users.filter(sub => sub.referralCode === u.referralCode).length;
        return { username: u.username, refs: refCount, rank: getRank(refCount).name };
    })
    .sort((a, b) => b.refs - a.refs) // Trier du plus grand au plus petit
    .slice(0, 10); // Prendre seulement les 10 meilleurs
    
    res.json(topTen);
});
// Logique du CHAT GLOBAL (Stockage des 50 derniers messages)
let globalMessages = [];

app.post('/api/send-message', (req, res) => {
    const { userId, text } = req.body;
    const user = users.find(u => u.id == userId);
    if (user) {
        const newMessage = {
            username: user.username,
            rank: getRank(users.filter(sub => sub.referralCode === user.referralCode).length).name,
            text: text.substring(0, 100), // Limite à 100 caractères
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        };
        globalMessages.push(newMessage);
        if (globalMessages.length > 50) globalMessages.shift(); // Garder seulement les 50 derniers
        res.json({ success: true });
    }
});

app.get('/api/messages', (req, res) => res.json(globalMessages));
// Route pour supprimer un message (Admin)
app.post('/api/admin/delete-message', (req, res) => {
    const { msgIndex } = req.body;
    if (globalMessages[msgIndex]) {
        globalMessages.splice(msgIndex, 1);
        res.json({ success: true });
    } else { res.status(404).send(); }
});
