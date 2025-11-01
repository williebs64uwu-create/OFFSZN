import { supabase } from '../../database/connection.js';
import { hashPassword, comparePassword } from '../../services/hashing/bcryptService.js';
import { generateToken } from '../../auth/jwt/jwtUtil.js';
import { v4 as uuidv4 } from 'uuid';

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

    } catch (err) {
        console.error("Error en loginUser:", err.message);
        res.status(500).json({ error: err.message || 'Error en el servidor durante el login.' });
    }
};