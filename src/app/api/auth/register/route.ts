import { NextResponse } from 'next/server';
import dbConnect from '@/utils/db';
import User from '@/models/User';
import { z } from 'zod';

const registerSchema = z.object({
  username: z.string().min(3).max(20), // Removed regex
  email: z.string().email().min(1).max(255),
  password: z.string().min(8), // Removed max length and complexity check
  name: z.string().optional(), // Simplified
  agreeToTerms: z.boolean().refine(val => val === true)
});

export async function POST(request: Request) {
  await dbConnect();
  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {

      return NextResponse.json({ message: 'Validation failed', errors: result.error.flatten() }, { status: 400 });
    }

    const { username, email, password, name } = result.data;

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }]
    });
    if (existingUser) {
      return NextResponse.json({ message: 'User already exists' }, { status: 409 });
    }

    // Password complexity check removed as per requirements

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
