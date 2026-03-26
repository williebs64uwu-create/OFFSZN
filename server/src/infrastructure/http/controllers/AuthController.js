import { supabase } from '../../database/connection.js';
import { sendOffsznEmail } from '../../../shared/utils/mailer.js';
import { hashPassword, comparePassword } from '../../services/hashing/bcryptService.js';
import { generateToken } from '../../auth/jwt/jwtUtil.js';
import { v4 as uuidv4 } from 'uuid';

export const checkEmailAvailability = async (req, res) => {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
        return res.status(400).json({ available: false, message: 'Email inválido.' });
    }

    try {
        const { data: existingUser, error } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (error) throw error;

        if (existingUser) {
            return res.status(200).json({ available: false, message: 'Este email ya tiene una cuenta asociada.' });
        } else {
            return res.status(200).json({ available: true });
        }
    } catch (err) {
        console.error("Error en checkEmailAvailability:", err.message);
        res.status(500).json({ available: false, message: 'Error al verificar el email.' });
    }
};

export const checkNicknameAvailability = async (req, res) => {
    const { nickname } = req.body;

    if (!nickname || nickname.length < 3 || nickname.includes(' ')) {
        return res.status(400).json({ available: false, message: 'Nickname inválido (mínimo 3 caracteres, sin espacios).' });
    }

    try {
        const { data: existingUser, error } = await supabase
            .from('users')
            .select('id')
            .eq('nickname', nickname)
            .maybeSingle();

        if (error) throw error;

        if (existingUser) {
            return res.status(200).json({ available: false, message: 'Este nickname ya está en uso.' });
        } else {
            return res.status(200).json({ available: true });
        }

    } catch (err) {
        console.error("Error en checkNicknameAvailability:", err.message);
        res.status(500).json({ available: false, message: 'Error al verificar el nickname.' });
    }
};

export const registerUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }

        const hashedPassword = await hashPassword(password);

        const tempNickname = `user_${uuidv4().substring(0, 8)}`;

        const { data, error } = await supabase
            .from('users')
            .insert([{
                email: email,
                password: hashedPassword,
                nickname: tempNickname
            }])
            .select('id, email, created_at, nickname, is_admin');

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: 'Este email ya está registrado' });
            }
            throw error;
        }

        if (!data || data.length === 0) {
            throw new Error('No se pudo crear el usuario.');
        }
        const newUser = data[0];

        // res.status(201).json({ message: 'Usuario registrado exitosamente.', user: newUser });

        const tokenPayload = {
            userId: newUser.id,
            email: newUser.email,
            isAdmin: newUser.is_admin || false
        };
        const token = generateToken(tokenPayload);

        res.status(201).json({
            message: 'Usuario registrado. Completa tu perfil.',
            token: token,
            onboardingRequired: true,
            user: newUser
        });

        // 📧 WELCOME EMAIL (Background)
        try {
            const welcomeHtml = `
                <div style="font-family: 'Segoe UI', sans-serif; padding: 40px; background: #0a0a0a; color: #fff; max-width: 600px; border: 1px solid #222; border-radius: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <img src="https://offszn.lat/favicon.ico" alt="OFFSZN" style="height: 60px;">
                    </div>
                    <h1 style="color: #8b5cf6; font-size: 1.8rem; margin-bottom: 20px; text-align: center;">¡Bienvenido a la comunidad, ${newUser.nickname}! 🌊</h1>
                    <p style="color: #ccc; font-size: 1.05rem; line-height: 1.6;">Estamos emocionados de tenerte en <b>OFFSZN</b>. Ahora tienes acceso a los mejores kits, presets y una comunidad de productores listos para elevar su sonido.</p>
                    <div style="background: rgba(139, 92, 246, 0.1); padding: 20px; border-radius: 12px; margin: 25px 0;">
                        <h3 style="color: #a78bfa; margin: 0 0 10px;">Próximos pasos:</h3>
                        <ul style="color: #94a3b8; margin: 0; padding-left: 20px; line-height: 1.6;">
                            <li>Completa tu perfil de artista</li>
                            <li>Explora los kits curados por expertos</li>
                            <li>Conéctate con otros productores</li>
                        </ul>
                    </div>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="https://offszn.lat/explorar.html" style="display: inline-block; background: #fff; color: #000; padding: 14px 40px; border-radius: 14px; text-decoration: none; font-weight: 700; font-size: 1rem;">Empezar a Explorar</a>
                    </div>
                    <hr style="border: 0; border-top: 1px solid #222; margin: 35px 0;">
                    <p style="font-size: 0.8rem; color: #555; text-align: center;">¿Necesitas ayuda? Escríbenos a <a href="mailto:soporte@offszn.lat" style="color: #8b5cf6; text-decoration: none;">soporte@offszn.lat</a></p>
                </div>
            `;
            sendOffsznEmail({
                to: newUser.email,
                subject: '🌊 Bienvenido a la familia OFFSZN',
                html: welcomeHtml,
                fromName: 'OFFSZN'
            }).catch(mailErr => console.error("[Email] Welcome failed:", mailErr));
        } catch (mailErr) {
            console.error("[Email] Welcome failed:", mailErr);
        }

    } catch (err) {
        console.error("Error en registerUser:", err.message);
        res.status(500).json({ error: err.message || 'Error al registrar el usuario' });
    }
};

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('*, is_admin')
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        const isPasswordValid = await comparePassword(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        const tokenPayload = {
            userId: user.id,
            email: user.email,
            isAdmin: user.is_admin || false,
            nickname: user.nickname,
            is_producer: user.is_producer || false
        };

        const token = generateToken(tokenPayload);

        const userResponse = {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            created_at: user.created_at,
            isAdmin: user.is_admin || false,
            nickname: user.nickname,
            is_producer: user.is_producer || false
        };

        res.status(200).json({
            message: 'Inicio de sesión exitoso',
            token: token,
            user: userResponse
        });

        // 🛡️ LOGIN SECURITY ALERT (Background)
        try {
            const ip = req.ip || req.headers['x-forwarded-for'] || 'IP Desconocida';
            const userAgent = req.headers['user-agent'] || 'Dispositivo Desconocido';
            const date = new Date().toLocaleString('es-ES', { timeZone: 'America/Lima' });

            const loginHtml = `
                <div style="font-family: 'Segoe UI', sans-serif; padding: 40px; background: #0a0a0a; color: #fff; max-width: 600px; border: 1px solid #222; border-radius: 20px;">
                    <h2 style="color: #ef4444; margin-bottom: 20px;">🛡️ Alerta de Inicio de Sesión</h2>
                    <p style="color: #ccc; font-size: 1rem; line-height: 1.6;">Hola <b>${user.nickname}</b>, hemos detectado un nuevo inicio de sesión en tu cuenta de OFFSZN.</p>
                    <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid #222; border-radius: 12px; padding: 20px; margin: 20px 0;">
                        <p style="margin: 0 0 10px; color: #888; font-size: 0.9rem;"><b>Fecha:</b> ${date}</p>
                        <p style="margin: 0 0 10px; color: #888; font-size: 0.9rem;"><b>Dispositivo:</b> ${userAgent}</p>
                        <p style="margin: 0; color: #888; font-size: 0.9rem;"><b>IP:</b> ${ip}</p>
                    </div>
                    <p style="color: #94a3b8; font-size: 0.9rem; line-height: 1.6;">Si has sido tú, puedes ignorar este mensaje. Si no reconoces esta actividad, por favor contacta a nuestro equipo de soporte de inmediato para proteger tu cuenta.</p>
                    <div style="text-align: center; margin-top: 25px;">
                        <a href="mailto:soporte@offszn.lat" style="display: inline-block; background: #f43f5e; color: #fff; padding: 12px 30px; border-radius: 10px; text-decoration: none; font-weight: 700;">Contactar Soporte</a>
                    </div>
                </div>
            `;
            sendOffsznEmail({
                to: user.email,
                subject: '🛡️ Seguridad: Nuevo inicio de sesión detectado',
                html: loginHtml,
                fromName: 'OFFSZN Security'
            }).catch(mailErr => console.error("[Email] Login alert failed:", mailErr));
        } catch (mailErr) {
            console.error("[Email] Login alert failed:", mailErr);
        }

    } catch (err) {
        console.error("Error en loginUser:", err.message);
        res.status(500).json({ error: err.message || 'Error en el servidor durante el login.' });
    }
};