import { NextResponse } from 'next/server';
import dbConnect from '@/utils/db';
import User from '@/models/User';
import { z } from 'zod';

const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email().min(1).max(255),
  password: z.string().min(8).max(100),
  name: z.string().max(50).optional(),
  agreeToTerms: z.boolean().refine(val => val === true)
});

function validatePasswordComplexity(password: string) {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter required');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter required');
  if (!/[0-9]/.test(password)) errors.push('At least one number required');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('At least one special character required');
  return { isValid: errors.length === 0, errors };
}

export async function POST(request: Request) {
  await dbConnect();
  try {
    const body = await request.json();
    const { username, email, password, name } = registerSchema.parse(body);

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }]
    });
    if (existingUser) {
      return NextResponse.json({ message: 'User already exists' }, { status: 409 });
    }

    const passwordCheck = validatePasswordComplexity(password);
    if (!passwordCheck.isValid) {
      return NextResponse.json({ message: 'Password complexity error', errors: passwordCheck.errors }, { status: 400 });
    }

    const newUser = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      name: name?.trim() || ''
    });

    await newUser.save();

    return NextResponse.json({
      message: 'User registered successfully',
      user: { id: newUser._id, username: newUser.username, email: newUser.email }
    }, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
