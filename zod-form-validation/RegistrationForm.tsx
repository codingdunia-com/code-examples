// From: https://codingdunia.com/blog/form-validation-zod-typescript/
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterForm } from './schema';

export function RegistrationForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = (data: RegisterForm) => {
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <input {...register('name')} placeholder="Full name" />
        {errors.name && <p>{errors.name.message}</p>}
      </div>
      <div>
        <input {...register('email')} placeholder="Email" type="email" />
        {errors.email && <p>{errors.email.message}</p>}
      </div>
      <div>
        <input {...register('password')} placeholder="Password" type="password" />
        {errors.password && <p>{errors.password.message}</p>}
      </div>
      <div>
        <input {...register('confirmPassword')} placeholder="Confirm password" type="password" />
        {errors.confirmPassword && <p>{errors.confirmPassword.message}</p>}
      </div>
      <button type="submit">Create account</button>
    </form>
  );
}
