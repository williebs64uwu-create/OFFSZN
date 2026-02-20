const fs = require('fs');
const file = 'c:\\\\Users\\\\Willie\\\\Desktop\\\\OFFSZN\\\\css\\\\navbar.css';
let content = fs.readFileSync(file, 'utf8');

const regex = /\/\*\s*Auth actions \([^)]*\)\s*\*\/[\s\S]*?(?=\/\*\s*Off-canvas: hide everything except.*\s*\*\/)/;

const replacement = `/* Auth actions (avatar, messages, notifications) */
     .mobile-auth-actions {
         display: flex;
         align-items: center;
         gap: 8px;
     }

     .mobile-notif-btn, .mobile-cart-btn {
         background: #1a1a1a;
         border: 1px solid rgba(255, 255, 255, 0.05);
         color: #e5e5e5;
         font-size: 1.1rem;
         cursor: pointer;
         width: 36px;
         height: 36px;
         padding: 0;
         border-radius: 50%;
         transition: all 0.2s;
         position: relative;
         display: flex;
         align-items: center;
         justify-content: center;
         text-decoration: none;
     }

     .mobile-notif-btn:hover, .mobile-cart-btn:hover {
         color: #fff;
         background: #262626;
     }

     .mobile-notif-badge, .mobile-cart-badge {
         position: absolute;
         top: -4px;
         right: -4px;
         background: #ef4444; /* Standard red badge */
         color: #fff;
         font-size: 0.55rem;
         font-weight: 700;
         min-width: 16px;
         height: 16px;
         border-radius: 8px;
         display: flex;
         align-items: center;
         justify-content: center;
         line-height: 1;
         border: 2px solid #000;
     }

     .mobile-avatar-btn {
         width: 36px;
         height: 36px;
         border-radius: 50%;
         background: linear-gradient(135deg, #8b5cf6, #6d28d9);
         display: flex;
         align-items: center;
         justify-content: center;
         cursor: pointer;
         font-size: 0.9rem;
         font-weight: 700;
         color: #fff;
         overflow: hidden;
         transition: all 0.2s;
         border: 1px solid rgba(255, 255, 255, 0.05);
     }

     .mobile-avatar-btn:hover {
         box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.4);
     }

     `;

const newContent = content.replace(regex, replacement);

if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Successfully updated navbar.css');
} else {
    console.log('Regex did not match. No changes made.');
}
