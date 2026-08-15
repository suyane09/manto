import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ProductGallery from "@/components/ProductGallery";
import AboutSection from "@/components/AboutSection";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import CartDrawer from "@/components/CartDrawer";
import AccountDrawer from "@/components/AccountDrawer";

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <ProductGallery />
      <AboutSection />
      <Footer />
      <WhatsAppFloat />
      <CartDrawer />
      <AccountDrawer />
    </div>
  );
}

export default Home;
