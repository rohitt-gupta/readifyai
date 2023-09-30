// check if he is subscribes or not!
import BillingForm from "@/components/BillingFOrm"
import { getUserSubscriptionPlan } from "@/lib/stripe"

const Page = async () => {
  const subscriptionPlan = await getUserSubscriptionPlan()

  return <BillingForm subscriptionPlan={subscriptionPlan} />
}

export default Page